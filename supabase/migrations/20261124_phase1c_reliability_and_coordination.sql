-- REVIEW AND APPLY MANUALLY TO football-scores-dev ONLY.
-- Depends on both Phase 1B migrations. No application code runs this file.

begin;

create table if not exists public.football_cache_leases (
  cache_key text primary key,
  owner_token uuid not null,
  acquired_at timestamptz not null default clock_timestamp(),
  lease_expires_at timestamptz not null,
  constraint football_cache_lease_future check (lease_expires_at > acquired_at)
);
create index if not exists football_cache_leases_expiry_idx on public.football_cache_leases (lease_expires_at);

create table if not exists public.football_api_attempts (
  attempt_id uuid primary key,
  quota_scope text not null,
  attempted_at timestamptz not null,
  usage_day date not null,
  essential boolean not null default false,
  reserved_daily_limit integer not null,
  reserved_daily_reserve integer not null,
  reserved_minute_limit integer not null,
  reserved_minute_reserve integer not null,
  state text not null check (state in ('RESERVED','DISPATCHED','FINALISED','UNKNOWN_OUTCOME','CANCELLED','RECONCILED')),
  reserved_at timestamptz not null default clock_timestamp(),
  reservation_expires_at timestamptz not null,
  dispatched_at timestamptz,
  finalised_at timestamptz,
  outcome text check (outcome is null or outcome in ('success','http_error','provider_error','network_error','timeout')),
  http_status integer check (http_status is null or http_status between 100 and 599),
  provider_limit integer check (provider_limit is null or provider_limit >= 0),
  provider_remaining integer check (provider_remaining is null or provider_remaining >= 0),
  provider_minute_limit integer check (provider_minute_limit is null or provider_minute_limit >= 0),
  provider_minute_remaining integer check (provider_minute_remaining is null or provider_minute_remaining >= 0),
  quota_observed_at timestamptz
);
create index if not exists football_api_attempts_attempted_idx on public.football_api_attempts (quota_scope, attempted_at);
create index if not exists football_api_attempts_quota_idx on public.football_api_attempts (quota_scope, usage_day, state);
create index if not exists football_api_attempts_dispatch_idx on public.football_api_attempts (quota_scope, dispatched_at) where dispatched_at is not null;

alter table public.football_api_usage_daily add column if not exists quota_observed_at timestamptz;
alter table public.football_api_usage_daily add column if not exists provider_minute_limit integer;
alter table public.football_api_usage_daily add column if not exists provider_minute_remaining integer;
revoke execute on function public.record_football_api_attempt(text,integer,integer,integer) from service_role;
revoke execute on function public.record_football_api_call(integer,integer,integer) from service_role;
alter table public.football_cache_leases enable row level security;
alter table public.football_api_attempts enable row level security;
revoke all on public.football_cache_leases from public, anon, authenticated;
revoke all on public.football_api_attempts from public, anon, authenticated;
grant select,insert,update,delete on public.football_provider_cache, public.football_api_usage_daily, public.football_cache_leases, public.football_api_attempts to service_role;

create or replace function public.acquire_football_cache_lease(p_cache_key text, p_owner_token uuid, p_lease_seconds integer default 20)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_cache_key is null or length(p_cache_key) <> 64 or p_cache_key !~ '^[0-9a-f]+$' or p_owner_token is null then raise exception 'Invalid cache lease request'; end if;
  if p_lease_seconds is null or p_lease_seconds < 5 or p_lease_seconds > 120 then raise exception 'Lease duration must be between 5 and 120 seconds'; end if;
  insert into public.football_cache_leases(cache_key,owner_token,acquired_at,lease_expires_at)
  values(p_cache_key,p_owner_token,clock_timestamp(),clock_timestamp()+make_interval(secs=>p_lease_seconds))
  on conflict(cache_key) do update set owner_token=excluded.owner_token, acquired_at=excluded.acquired_at, lease_expires_at=excluded.lease_expires_at
  where public.football_cache_leases.lease_expires_at <= clock_timestamp();
  return found;
end $$;

create or replace function public.release_football_cache_lease(p_cache_key text, p_owner_token uuid)
returns boolean language sql security definer set search_path = '' as $$
  with deleted as (delete from public.football_cache_leases where cache_key=p_cache_key and owner_token=p_owner_token returning 1)
  select exists(select 1 from deleted)
$$;

create or replace function public.write_football_cache_if_lease_owner(
  p_cache_key text, p_payload jsonb, p_expires_at timestamptz, p_stale_until timestamptz, p_owner_token uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_expires timestamptz;
begin
  if jsonb_typeof(p_payload) <> 'array' then raise exception 'Cache payload must be an array'; end if;
  if p_expires_at <= clock_timestamp() or p_stale_until < p_expires_at then raise exception 'Invalid cache expiry'; end if;
  select owner_token,lease_expires_at into v_owner,v_expires
  from public.football_cache_leases where cache_key=p_cache_key for update;
  if not found or v_owner<>p_owner_token or v_expires<=clock_timestamp() then return false; end if;
  insert into public.football_provider_cache(cache_key,payload,expires_at,stale_until,updated_at)
  values(p_cache_key,p_payload,p_expires_at,p_stale_until,clock_timestamp())
  on conflict(cache_key) do update set payload=excluded.payload,expires_at=excluded.expires_at,stale_until=excluded.stale_until,updated_at=excluded.updated_at;
  return found;
end $$;

create or replace function public.reserve_football_api_quota(
  p_attempt_id uuid,p_attempted_at timestamptz,p_quota_scope text,p_essential boolean,
  p_daily_limit integer,p_reserve integer,p_minute_limit integer,p_minute_reserve integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz; v_day date; v_state text; v_expiry timestamptz; v_daily bigint; v_minute bigint;
        v_reported_daily integer; v_reported_minute integer; v_effective_daily integer; v_effective_minute integer;
begin
  if p_attempt_id is null or p_attempted_at is null or p_quota_scope is null or p_essential is null or p_quota_scope !~ '^[A-Za-z0-9_.:-]{1,100}$' then return 'INVALID_REQUEST'; end if;
  if p_daily_limit<1 or p_daily_limit>10000000 or p_reserve<0 or p_reserve>p_daily_limit or p_minute_limit<1 or p_minute_limit>10000 or p_minute_reserve<0 or p_minute_reserve>p_minute_limit then return 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('football_quota:'||p_quota_scope,0));
  v_now:=clock_timestamp(); v_day:=(v_now at time zone 'UTC')::date;
  if p_attempted_at<v_now-interval '5 minutes' or p_attempted_at>v_now+interval '5 minutes' then return 'INVALID_REQUEST'; end if;
  select state,reservation_expires_at into v_state,v_expiry from public.football_api_attempts where attempt_id=p_attempt_id for update;
  if found then
    if v_state='RESERVED' and v_expiry>v_now then return 'ALREADY_RESERVED'; end if;
    if v_state in ('DISPATCHED','UNKNOWN_OUTCOME') then return 'ALREADY_DISPATCHED'; end if;
    if v_state in ('FINALISED','RECONCILED') then return 'ALREADY_FINALISED'; end if;
    return 'INVALID_REQUEST';
  end if;
  update public.football_api_attempts set state='CANCELLED',finalised_at=v_now
  where attempt_id in (select attempt_id from public.football_api_attempts where quota_scope=p_quota_scope and state='RESERVED' and reservation_expires_at<=v_now order by reservation_expires_at limit 100 for update skip locked);
  update public.football_api_attempts set state='UNKNOWN_OUTCOME'
  where attempt_id in (select attempt_id from public.football_api_attempts where quota_scope=p_quota_scope and state='DISPATCHED' and dispatched_at<=v_now-interval '2 minutes' order by dispatched_at limit 100 for update skip locked);
  select provider_limit,provider_minute_limit into v_reported_daily,v_reported_minute from public.football_api_usage_daily where day=v_day;
  v_effective_daily:=least(p_daily_limit,coalesce(v_reported_daily,p_daily_limit));
  v_effective_minute:=least(p_minute_limit,coalesce(v_reported_minute,p_minute_limit));
  select count(*) into v_daily from public.football_api_attempts where quota_scope=p_quota_scope and usage_day=v_day and ((state='RESERVED' and reservation_expires_at>v_now) or state in ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED'));
  select count(*) into v_minute from public.football_api_attempts where quota_scope=p_quota_scope and ((state='RESERVED' and reserved_at>v_now-interval '1 minute' and reservation_expires_at>v_now) or (state in ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED') and dispatched_at>v_now-interval '1 minute'));
  if v_daily>=v_effective_daily-case when p_essential then 0 else least(p_reserve,v_effective_daily) end then return 'DAILY_LIMIT_REACHED'; end if;
  if v_minute>=v_effective_minute-case when p_essential then 0 else least(p_minute_reserve,v_effective_minute) end then return 'MINUTE_LIMIT_REACHED'; end if;
  insert into public.football_api_attempts(attempt_id,quota_scope,attempted_at,usage_day,essential,reserved_daily_limit,reserved_daily_reserve,reserved_minute_limit,reserved_minute_reserve,state,reserved_at,reservation_expires_at)
  values(p_attempt_id,p_quota_scope,p_attempted_at,v_day,p_essential,v_effective_daily,p_reserve,v_effective_minute,p_minute_reserve,'RESERVED',v_now,v_now+interval '2 minutes');
  return 'ACQUIRED';
end $$;

create or replace function public.dispatch_football_api_attempt(p_attempt_id uuid,p_quota_scope text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz; v_state text; v_expiry timestamptz; v_reserved_at timestamptz; v_scope text; v_usage_day date; v_day date; v_daily bigint; v_minute bigint; v_limit integer; v_reserve integer; v_minute_limit integer; v_minute_reserve integer; v_essential boolean;
begin
  if p_attempt_id is null or p_quota_scope is null then return 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended('football_quota:'||p_quota_scope,0));
  v_now:=clock_timestamp(); v_day:=(v_now at time zone 'UTC')::date;
  select quota_scope,state,reservation_expires_at,reserved_at,usage_day,reserved_daily_limit,reserved_daily_reserve,reserved_minute_limit,reserved_minute_reserve,essential into v_scope,v_state,v_expiry,v_reserved_at,v_usage_day,v_limit,v_reserve,v_minute_limit,v_minute_reserve,v_essential from public.football_api_attempts where attempt_id=p_attempt_id for update;
  if not found or v_scope<>p_quota_scope then return 'INVALID_REQUEST'; end if;
  if v_state='RESERVED' and v_expiry>v_now then
    if v_usage_day<>v_day then
      select count(*) into v_daily from public.football_api_attempts where quota_scope=p_quota_scope and usage_day=v_day and ((state='RESERVED' and reservation_expires_at>v_now) or state in ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED'));
      if v_daily>=v_limit-case when v_essential then 0 else least(v_reserve,v_limit) end then update public.football_api_attempts set state='CANCELLED',finalised_at=v_now where attempt_id=p_attempt_id; return 'DAILY_LIMIT_REACHED'; end if;
    end if;
    if v_reserved_at<=v_now-interval '1 minute' then
      select count(*) into v_minute from public.football_api_attempts where quota_scope=p_quota_scope and state in ('DISPATCHED','FINALISED','UNKNOWN_OUTCOME','RECONCILED') and dispatched_at>v_now-interval '1 minute';
      if v_minute>=v_minute_limit-case when v_essential then 0 else least(v_minute_reserve,v_minute_limit) end then update public.football_api_attempts set state='CANCELLED',finalised_at=v_now where attempt_id=p_attempt_id; return 'MINUTE_LIMIT_REACHED'; end if;
    end if;
    update public.football_api_attempts set state='DISPATCHED',dispatched_at=v_now,usage_day=v_day where attempt_id=p_attempt_id;
    return 'DISPATCHED';
  end if;
  if v_state='RESERVED' then update public.football_api_attempts set state='CANCELLED',finalised_at=v_now where attempt_id=p_attempt_id; return 'RESERVATION_EXPIRED'; end if;
  if v_state in ('DISPATCHED','UNKNOWN_OUTCOME') then return 'ALREADY_DISPATCHED'; end if;
  if v_state in ('FINALISED','RECONCILED') then return 'ALREADY_FINALISED'; end if;
  return 'INVALID_REQUEST';
end $$;

create or replace function public.record_football_api_attempt(
  p_attempt_id uuid,p_quota_scope text,p_attempted_at timestamptz,p_outcome text,p_status integer default null,
  p_limit integer default null,p_remaining integer default null,p_quota_observed_at timestamptz default null,
  p_minute_limit integer default null,p_minute_remaining integer default null
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_state text; v_scope text; v_day date; v_attempted_at timestamptz;
begin
  if p_outcome not in ('success','http_error','provider_error','network_error','timeout') then raise exception 'Invalid football API outcome'; end if;
  if p_attempt_id is null or p_quota_scope is null or p_quota_scope !~ '^[A-Za-z0-9_.:-]{1,100}$' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('football_quota:'||p_quota_scope,0));
  select quota_scope,state,usage_day,attempted_at into v_scope,v_state,v_day,v_attempted_at from public.football_api_attempts where attempt_id=p_attempt_id for update;
  if not found or v_scope<>p_quota_scope then return false; end if;
  if p_attempted_at is null or p_attempted_at<>v_attempted_at then return false; end if;
  if v_state in ('FINALISED','RECONCILED') then return false; end if;
  if v_state not in ('DISPATCHED','UNKNOWN_OUTCOME') then return false; end if;
  update public.football_api_attempts set state='FINALISED',finalised_at=clock_timestamp(),outcome=p_outcome,http_status=p_status,
    provider_limit=p_limit,provider_remaining=p_remaining,provider_minute_limit=p_minute_limit,provider_minute_remaining=p_minute_remaining,quota_observed_at=p_quota_observed_at
  where attempt_id=p_attempt_id;
  insert into public.football_api_usage_daily(day,outbound_calls,failed_calls,successful_responses,http_errors,provider_errors,network_errors,timeouts,provider_limit,provider_remaining,provider_minute_limit,provider_minute_remaining,last_call_at,quota_observed_at)
  values(v_day,1,(p_outcome<>'success')::integer,(p_outcome='success')::integer,(p_outcome='http_error')::integer,(p_outcome='provider_error')::integer,(p_outcome='network_error')::integer,(p_outcome='timeout')::integer,p_limit,p_remaining,p_minute_limit,p_minute_remaining,v_attempted_at,p_quota_observed_at)
  on conflict(day) do update set outbound_calls=public.football_api_usage_daily.outbound_calls+1,failed_calls=public.football_api_usage_daily.failed_calls+excluded.failed_calls,
    successful_responses=public.football_api_usage_daily.successful_responses+excluded.successful_responses,http_errors=public.football_api_usage_daily.http_errors+excluded.http_errors,
    provider_errors=public.football_api_usage_daily.provider_errors+excluded.provider_errors,network_errors=public.football_api_usage_daily.network_errors+excluded.network_errors,timeouts=public.football_api_usage_daily.timeouts+excluded.timeouts,
    provider_limit=case when excluded.quota_observed_at is not null and (public.football_api_usage_daily.quota_observed_at is null or excluded.quota_observed_at>=public.football_api_usage_daily.quota_observed_at) then coalesce(excluded.provider_limit,public.football_api_usage_daily.provider_limit) else public.football_api_usage_daily.provider_limit end,
    provider_remaining=case when excluded.quota_observed_at is not null and (public.football_api_usage_daily.quota_observed_at is null or excluded.quota_observed_at>=public.football_api_usage_daily.quota_observed_at) then coalesce(excluded.provider_remaining,public.football_api_usage_daily.provider_remaining) else public.football_api_usage_daily.provider_remaining end,
    provider_minute_limit=case when excluded.quota_observed_at is not null and (public.football_api_usage_daily.quota_observed_at is null or excluded.quota_observed_at>=public.football_api_usage_daily.quota_observed_at) then coalesce(excluded.provider_minute_limit,public.football_api_usage_daily.provider_minute_limit) else public.football_api_usage_daily.provider_minute_limit end,
    provider_minute_remaining=case when excluded.quota_observed_at is not null and (public.football_api_usage_daily.quota_observed_at is null or excluded.quota_observed_at>=public.football_api_usage_daily.quota_observed_at) then coalesce(excluded.provider_minute_remaining,public.football_api_usage_daily.provider_minute_remaining) else public.football_api_usage_daily.provider_minute_remaining end,
    quota_observed_at=greatest(public.football_api_usage_daily.quota_observed_at,excluded.quota_observed_at),last_call_at=greatest(public.football_api_usage_daily.last_call_at,excluded.last_call_at);
  return true;
end $$;

create or replace function public.cleanup_expired_football_cache_bounded(p_limit integer default 500)
returns table(cache_rows_deleted integer, lease_rows_deleted integer) language plpgsql security definer set search_path = '' as $$
begin
  if p_limit is null or p_limit<1 or p_limit>5000 then raise exception 'Cleanup limit must be between 1 and 5000'; end if;
  with doomed as (select cache_key from public.football_provider_cache where stale_until<=clock_timestamp() order by stale_until limit p_limit for update skip locked),
  deleted as (delete from public.football_provider_cache c using doomed d where c.cache_key=d.cache_key returning 1)
  select count(*)::integer into cache_rows_deleted from deleted;
  with doomed as (select cache_key from public.football_cache_leases where lease_expires_at<=clock_timestamp() order by lease_expires_at limit p_limit for update skip locked),
  deleted as (delete from public.football_cache_leases l using doomed d where l.cache_key=d.cache_key returning 1)
  select count(*)::integer into lease_rows_deleted from deleted;
  return next;
end $$;

revoke all on function public.acquire_football_cache_lease(text,uuid,integer), public.release_football_cache_lease(text,uuid), public.write_football_cache_if_lease_owner(text,jsonb,timestamptz,timestamptz,uuid), public.reserve_football_api_quota(uuid,timestamptz,text,boolean,integer,integer,integer,integer), public.dispatch_football_api_attempt(uuid,text), public.record_football_api_attempt(uuid,text,timestamptz,text,integer,integer,integer,timestamptz,integer,integer), public.cleanup_expired_football_cache_bounded(integer) from public, anon, authenticated;
grant execute on function public.acquire_football_cache_lease(text,uuid,integer), public.release_football_cache_lease(text,uuid), public.write_football_cache_if_lease_owner(text,jsonb,timestamptz,timestamptz,uuid), public.reserve_football_api_quota(uuid,timestamptz,text,boolean,integer,integer,integer,integer), public.dispatch_football_api_attempt(uuid,text), public.record_football_api_attempt(uuid,text,timestamptz,text,integer,integer,integer,timestamptz,integer,integer), public.cleanup_expired_football_cache_bounded(integer) to service_role;

alter function public.acquire_football_cache_lease(text,uuid,integer) owner to postgres;
alter function public.release_football_cache_lease(text,uuid) owner to postgres;
alter function public.write_football_cache_if_lease_owner(text,jsonb,timestamptz,timestamptz,uuid) owner to postgres;
alter function public.reserve_football_api_quota(uuid,timestamptz,text,boolean,integer,integer,integer,integer) owner to postgres;
alter function public.dispatch_football_api_attempt(uuid,text) owner to postgres;
alter function public.record_football_api_attempt(uuid,text,timestamptz,text,integer,integer,integer,timestamptz,integer,integer) owner to postgres;
alter function public.cleanup_expired_football_cache_bounded(integer) owner to postgres;

commit;
