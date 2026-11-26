-- Run manually in football-scores-dev after all three migrations.
-- Read-only catalogue checks plus transactional tests; ROLLBACK preserves application data.
begin;

select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename in ('football_provider_cache','football_api_usage_daily','football_cache_leases','football_api_attempts')
order by tablename;

select routine_name, security_type
from information_schema.routines
where routine_schema='public' and routine_name like '%football%'
order by routine_name;

select p.proname, pg_get_userbyid(p.proowner) as owner, p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ','), '') as function_config
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'acquire_football_cache_lease','release_football_cache_lease','write_football_cache_if_lease_owner',
  'record_football_api_attempt','reserve_football_api_quota','dispatch_football_api_attempt','cleanup_expired_football_cache_bounded'
) order by p.proname;

select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where specific_schema='public' and routine_name in (
  'acquire_football_cache_lease','release_football_cache_lease','write_football_cache_if_lease_owner',
  'record_football_api_attempt','reserve_football_api_quota','dispatch_football_api_attempt','cleanup_expired_football_cache_bounded'
) order by routine_name,grantee;

do $$
declare k text:=repeat('a',64); owner1 uuid:=gen_random_uuid(); owner2 uuid:=gen_random_uuid(); attempt uuid:=gen_random_uuid(); unknown_attempt uuid:=gen_random_uuid(); trigger_attempt uuid:=gen_random_uuid(); attempted timestamptz:=clock_timestamp(); n bigint; result text;
begin
  if not public.acquire_football_cache_lease(k,owner1,20) then raise exception 'initial lease acquisition failed'; end if;
  if public.acquire_football_cache_lease(k,owner2,20) then raise exception 'contended lease was acquired'; end if;
  if public.release_football_cache_lease(k,owner2) then raise exception 'non-owner released lease'; end if;
  if not public.write_football_cache_if_lease_owner(k,'[]'::jsonb,clock_timestamp()+interval '1 minute',clock_timestamp()+interval '2 minutes',owner1) then raise exception 'owner write failed'; end if;
  if not public.release_football_cache_lease(k,owner1) then raise exception 'owner release failed'; end if;

  if not public.acquire_football_cache_lease(k,owner1,20) then raise exception 'second lease acquisition failed'; end if;
  update public.football_cache_leases set acquired_at=clock_timestamp()-interval '2 minutes',lease_expires_at=clock_timestamp()-interval '1 minute' where cache_key=k;
  if not public.acquire_football_cache_lease(k,owner2,20) then raise exception 'expired lease recovery failed'; end if;
  if public.write_football_cache_if_lease_owner(k,'[{"owner":"old"}]'::jsonb,clock_timestamp()+interval '1 minute',clock_timestamp()+interval '2 minutes',owner1) then raise exception 'superseded owner wrote cache'; end if;
  if not public.write_football_cache_if_lease_owner(k,'[{"owner":"new"}]'::jsonb,clock_timestamp()+interval '1 minute',clock_timestamp()+interval '2 minutes',owner2) then raise exception 'replacement owner write failed'; end if;

  result:=public.reserve_football_api_quota(attempt,attempted,'phase1d-validation',true,100,10,10,2);
  if result<>'ACQUIRED' then raise exception 'reservation failed: %',result; end if;
  result:=public.reserve_football_api_quota(attempt,attempted,'phase1d-validation',true,100,10,10,2);
  if result<>'ALREADY_RESERVED' then raise exception 'duplicate reservation unsafe: %',result; end if;
  result:=public.dispatch_football_api_attempt(attempt,'phase1d-validation');
  if result<>'DISPATCHED' then raise exception 'dispatch failed: %',result; end if;
  result:=public.dispatch_football_api_attempt(attempt,'phase1d-validation');
  if result<>'ALREADY_DISPATCHED' then raise exception 'duplicate dispatch unsafe: %',result; end if;
  if not public.record_football_api_attempt(attempt,'phase1d-validation',attempted,'success',200,100,99,clock_timestamp(),10,9) then raise exception 'finalisation failed'; end if;
  if public.record_football_api_attempt(attempt,'phase1d-validation',attempted,'success',200,100,99,clock_timestamp(),10,9) then raise exception 'duplicate finalisation incremented'; end if;
  select count(*) into n from public.football_api_attempts where attempt_id=attempt;
  if n<>1 then raise exception 'attempt idempotency failed'; end if;

  result:=public.reserve_football_api_quota(unknown_attempt,attempted,'phase1d-unknown',true,100,0,10,0);
  if result<>'ACQUIRED' or public.dispatch_football_api_attempt(unknown_attempt,'phase1d-unknown')<>'DISPATCHED' then raise exception 'unknown-outcome setup failed'; end if;
  update public.football_api_attempts set dispatched_at=clock_timestamp()-interval '3 minutes' where attempt_id=unknown_attempt;
  result:=public.reserve_football_api_quota(trigger_attempt,clock_timestamp(),'phase1d-unknown',true,100,0,10,0);
  select count(*) into n from public.football_api_attempts where attempt_id=unknown_attempt and state='UNKNOWN_OUTCOME';
  if n<>1 then raise exception 'dispatched crash was not preserved as unknown outcome'; end if;

  begin perform public.cleanup_expired_football_cache_bounded(5001); raise exception 'invalid cleanup limit accepted';
  exception when others then if sqlerrm='invalid cleanup limit accepted' then raise; end if; end;
  begin perform public.cleanup_expired_football_cache_bounded(null); raise exception 'NULL cleanup limit accepted';
  exception when others then if sqlerrm='NULL cleanup limit accepted' then raise; end if; end;
  begin perform public.cleanup_expired_football_cache(null); raise exception 'NULL legacy cleanup limit accepted';
  exception when others then if sqlerrm='NULL legacy cleanup limit accepted' then raise; end if; end;
end $$;

rollback;
