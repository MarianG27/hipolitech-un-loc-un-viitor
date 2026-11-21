-- HIPOLITECH analytics: rulează o singură dată în Supabase SQL Editor
-- Nu există politici de INSERT/SELECT pentru anon sau authenticated.
-- Numai funcțiile Edge, care folosesc cheia secretă pe server, pot lucra cu datele brute.

begin;

create extension if not exists pgcrypto;

create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_page_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  page_path text not null check (page_path ~ '^/[A-Za-z0-9._/-]{0,159}$'),
  visitor_hash text not null check (visitor_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists analytics_page_events_occurred_at_idx
  on public.analytics_page_events (occurred_at desc);
create index if not exists analytics_page_events_active_idx
  on public.analytics_page_events (occurred_at desc, visitor_hash);
create index if not exists analytics_page_events_path_idx
  on public.analytics_page_events (page_path, occurred_at desc);

create table if not exists public.analytics_rate_limits (
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  created_at timestamptz not null default now(),
  primary key (key_hash, window_started_at)
);

create index if not exists analytics_rate_limits_created_at_idx
  on public.analytics_rate_limits (created_at);

alter table public.analytics_admins enable row level security;
alter table public.analytics_page_events enable row level security;
alter table public.analytics_rate_limits enable row level security;

-- Explicit least privilege: browser roles nu pot citi, adăuga, edita sau șterge nimic.
revoke all on table public.analytics_admins from public, anon, authenticated;
revoke all on table public.analytics_page_events from public, anon, authenticated;
revoke all on table public.analytics_rate_limits from public, anon, authenticated;
grant all on table public.analytics_admins to service_role;
grant all on table public.analytics_page_events to service_role;
grant all on table public.analytics_rate_limits to service_role;

-- Actualizare atomică a limitei de trafic. Nu este apelabilă de browser.
create or replace function public.consume_analytics_rate_limit(
  p_key_hash text,
  p_window_started_at timestamptz,
  p_limit integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  accepted boolean;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid analytics rate-limit input';
  end if;

  insert into public.analytics_rate_limits (key_hash, window_started_at, hits)
  values (p_key_hash, p_window_started_at, 1)
  on conflict (key_hash, window_started_at) do update
    set hits = public.analytics_rate_limits.hits + 1
    where public.analytics_rate_limits.hits < p_limit
  returning true into accepted;

  return coalesce(accepted, false);
end;
$$;

-- Funcția e apelabilă exclusiv cu cheia de serviciu în funcția Edge.
revoke all on function public.consume_analytics_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_analytics_rate_limit(text, timestamptz, integer) to service_role;

-- Agregă datele pe server. Nu expune hash-uri de vizitator.
create or replace function public.analytics_dashboard()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
  with bounds as (
    select now() as current_time, date_trunc('day', now()) as day_start
  ),
  page_totals as (
    select e.page_path, count(*)::bigint as views
    from public.analytics_page_events e, bounds b
    where e.occurred_at >= b.current_time - interval '30 days'
    group by e.page_path
    order by views desc, e.page_path asc
    limit 10
  )
  select jsonb_build_object(
    'totalViews', (select count(*)::bigint from public.analytics_page_events),
    'viewsToday', (select count(*)::bigint from public.analytics_page_events e, bounds b where e.occurred_at >= b.day_start),
    'activeVisitors', (select count(distinct e.visitor_hash)::bigint from public.analytics_page_events e, bounds b where e.occurred_at >= b.current_time - interval '5 minutes'),
    'topPages', coalesce((select jsonb_agg(jsonb_build_object('path', page_path, 'views', views) order by views desc, page_path asc) from page_totals), '[]'::jsonb)
  );
$$;

revoke all on function public.analytics_dashboard() from public, anon, authenticated;
grant execute on function public.analytics_dashboard() to service_role;

-- Rulează periodic din SQL Editor (sau dintr-un job controlat de administrator) pentru retenție.
create or replace function public.purge_analytics_data()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.analytics_page_events where occurred_at < now() - interval '90 days';
  delete from public.analytics_rate_limits where created_at < now() - interval '2 days';
end;
$$;

revoke all on function public.purge_analytics_data() from public, anon, authenticated;
grant execute on function public.purge_analytics_data() to service_role;

commit;
