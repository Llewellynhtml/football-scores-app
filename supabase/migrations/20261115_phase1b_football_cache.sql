-- Apply manually to the intended Supabase project before enabling persistent mode.
-- These tables contain licensed football data and operational metrics. No public grants.
create table if not exists public.football_provider_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  stale_until timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists football_provider_cache_stale_idx on public.football_provider_cache (stale_until);

create table if not exists public.football_api_usage_daily (
  day date primary key,
  outbound_calls bigint not null default 0,
  failed_calls bigint not null default 0,
  provider_limit integer,
  provider_remaining integer,
  last_call_at timestamptz
);
alter table public.football_provider_cache enable row level security;
alter table public.football_api_usage_daily enable row level security;
revoke all on public.football_provider_cache from anon, authenticated;
revoke all on public.football_api_usage_daily from anon, authenticated;

create or replace function public.record_football_api_call(
  p_status integer, p_limit integer default null, p_remaining integer default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.football_api_usage_daily (day,outbound_calls,failed_calls,provider_limit,provider_remaining,last_call_at)
  values ((now() at time zone 'UTC')::date,1,case when p_status between 200 and 299 then 0 else 1 end,p_limit,p_remaining,now())
  on conflict (day) do update set
    outbound_calls = public.football_api_usage_daily.outbound_calls + 1,
    failed_calls = public.football_api_usage_daily.failed_calls + excluded.failed_calls,
    provider_limit = coalesce(excluded.provider_limit,public.football_api_usage_daily.provider_limit),
    provider_remaining = coalesce(excluded.provider_remaining,public.football_api_usage_daily.provider_remaining),
    last_call_at = now();
end; $$;
revoke all on function public.record_football_api_call(integer,integer,integer) from public, anon, authenticated;
grant execute on function public.record_football_api_call(integer,integer,integer) to service_role;
