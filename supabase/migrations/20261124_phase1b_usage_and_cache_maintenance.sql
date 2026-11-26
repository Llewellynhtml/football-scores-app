-- REVIEW AND APPLY MANUALLY. This migration is not executed by the application.
-- It expands usage outcomes and provides a bounded, opt-in cache cleanup RPC.
alter table public.football_api_usage_daily
  add column if not exists successful_responses bigint not null default 0,
  add column if not exists http_errors bigint not null default 0,
  add column if not exists provider_errors bigint not null default 0,
  add column if not exists network_errors bigint not null default 0,
  add column if not exists timeouts bigint not null default 0;

create or replace function public.record_football_api_attempt(
  p_outcome text,
  p_status integer default null,
  p_limit integer default null,
  p_remaining integer default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome not in ('success', 'http_error', 'provider_error', 'network_error', 'timeout') then
    raise exception 'Invalid football API outcome';
  end if;

  insert into public.football_api_usage_daily (
    day, outbound_calls, failed_calls, successful_responses, http_errors,
    provider_errors, network_errors, timeouts, provider_limit,
    provider_remaining, last_call_at
  ) values (
    (now() at time zone 'UTC')::date,
    1,
    case when p_outcome = 'success' then 0 else 1 end,
    case when p_outcome = 'success' then 1 else 0 end,
    case when p_outcome = 'http_error' then 1 else 0 end,
    case when p_outcome = 'provider_error' then 1 else 0 end,
    case when p_outcome = 'network_error' then 1 else 0 end,
    case when p_outcome = 'timeout' then 1 else 0 end,
    p_limit, p_remaining, now()
  ) on conflict (day) do update set
    outbound_calls = public.football_api_usage_daily.outbound_calls + 1,
    failed_calls = public.football_api_usage_daily.failed_calls + excluded.failed_calls,
    successful_responses = public.football_api_usage_daily.successful_responses + excluded.successful_responses,
    http_errors = public.football_api_usage_daily.http_errors + excluded.http_errors,
    provider_errors = public.football_api_usage_daily.provider_errors + excluded.provider_errors,
    network_errors = public.football_api_usage_daily.network_errors + excluded.network_errors,
    timeouts = public.football_api_usage_daily.timeouts + excluded.timeouts,
    provider_limit = coalesce(excluded.provider_limit, public.football_api_usage_daily.provider_limit),
    provider_remaining = coalesce(excluded.provider_remaining, public.football_api_usage_daily.provider_remaining),
    last_call_at = now();
end; $$;

revoke all on function public.record_football_api_attempt(text,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.record_football_api_attempt(text,integer,integer,integer) to service_role;

create or replace function public.cleanup_expired_football_cache(p_limit integer default 500)
returns integer language plpgsql security definer set search_path = '' as $$
declare deleted_count integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'Cleanup limit must be between 1 and 5000';
  end if;
  delete from public.football_provider_cache
  where ctid in (
    select ctid from public.football_provider_cache
    where stale_until <= now()
    order by stale_until
    limit p_limit
    for update skip locked
  );
  get diagnostics deleted_count = row_count;
  return deleted_count;
end; $$;

revoke all on function public.cleanup_expired_football_cache(integer) from public, anon, authenticated;
grant execute on function public.cleanup_expired_football_cache(integer) to service_role;
