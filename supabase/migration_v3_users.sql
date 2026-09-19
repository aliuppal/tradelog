-- ============================================================
-- TradeLog — Migration v3: User Profiles + Session Logs
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── User Profiles ─────────────────────────────────────────────
-- One row per user, auto-created on signup via trigger
create table if not exists public.user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  avatar_url      text,
  provider        text,                    -- 'google', 'email', etc.
  timezone        text default 'UTC',
  default_currency text default 'USD',
  onboarded       boolean default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

create policy "profiles_select" on public.user_profiles
  for select using (auth.uid() = id);
create policy "profiles_insert" on public.user_profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update" on public.user_profiles
  for update using (auth.uid() = id);

-- ── Auto-create profile on every new signup ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    provider
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_app_meta_data->>'provider', 'email')
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = coalesce(excluded.full_name, user_profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, user_profiles.avatar_url),
    provider   = coalesce(excluded.provider,   user_profiles.provider),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Session Logs ──────────────────────────────────────────────
-- Tracks every sign-in event for the user
create table if not exists public.session_logs (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  signed_in_at timestamptz not null default now(),
  provider     text,                        -- 'google' | 'email'
  ip_address   text,                        -- populated by app if available
  user_agent   text,                        -- browser info
  created_at   timestamptz not null default now()
);

alter table public.session_logs enable row level security;

create policy "sessions_select" on public.session_logs
  for select using (auth.uid() = user_id);
create policy "sessions_insert" on public.session_logs
  for insert with check (auth.uid() = user_id);

create index if not exists idx_session_logs_user
  on public.session_logs (user_id, signed_in_at desc);

-- ── Backfill existing users ───────────────────────────────────
-- Creates profiles for users who signed up before this migration
insert into public.user_profiles (id, email, full_name, avatar_url, provider)
select
  u.id,
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url',
  coalesce(u.raw_app_meta_data->>'provider', 'email')
from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.id = u.id
);

-- ============================================================
-- Done! Tables created:
--   public.user_profiles   — one row per user, auto-created on signup
--   public.session_logs    — one row per sign-in event
-- ============================================================
