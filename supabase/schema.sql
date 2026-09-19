-- ============================================================
-- TradeLog — Supabase Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- ── Enable UUID extension ────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Trades table ─────────────────────────────────────────────
create table if not exists public.trades (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,

  trade_date     date not null,
  symbol         text not null,
  side           text not null check (side in ('LONG', 'SHORT')),

  entry_price    numeric(18, 6),
  exit_price     numeric(18, 6),
  stop_loss      numeric(18, 6),
  take_profit    numeric(18, 6),
  quantity       numeric(18, 6),

  pnl            numeric(18, 2),
  rr             numeric(10, 4),

  setup          text,
  session        text,
  grade          text check (grade in ('A','B','C','D','F') or grade is null),
  emotion        text,
  screenshot_url text,
  notes          text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trades_updated_at on public.trades;
create trigger trades_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ── Journal notes table ──────────────────────────────────────
create table if not exists public.journal_notes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,

  note_date   date not null,
  title       text,
  body        text,
  mood        smallint check (mood between 1 and 5),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, note_date)
);

drop trigger if exists notes_updated_at on public.journal_notes;
create trigger notes_updated_at
  before update on public.journal_notes
  for each row execute function public.set_updated_at();

-- ── Row Level Security (RLS) ─────────────────────────────────
-- Trades: users can only see and modify their own trades
alter table public.trades enable row level security;

drop policy if exists "trades_select" on public.trades;
create policy "trades_select" on public.trades
  for select using (auth.uid() = user_id);

drop policy if exists "trades_insert" on public.trades;
create policy "trades_insert" on public.trades
  for insert with check (auth.uid() = user_id);

drop policy if exists "trades_update" on public.trades;
create policy "trades_update" on public.trades
  for update using (auth.uid() = user_id);

drop policy if exists "trades_delete" on public.trades;
create policy "trades_delete" on public.trades
  for delete using (auth.uid() = user_id);

-- Journal notes: users can only see and modify their own notes
alter table public.journal_notes enable row level security;

drop policy if exists "notes_select" on public.journal_notes;
create policy "notes_select" on public.journal_notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes_insert" on public.journal_notes;
create policy "notes_insert" on public.journal_notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes_update" on public.journal_notes;
create policy "notes_update" on public.journal_notes
  for update using (auth.uid() = user_id);

drop policy if exists "notes_delete" on public.journal_notes;
create policy "notes_delete" on public.journal_notes
  for delete using (auth.uid() = user_id);

-- ── Indexes for performance ──────────────────────────────────
create index if not exists idx_trades_user_date on public.trades (user_id, trade_date desc);
create index if not exists idx_trades_user_symbol on public.trades (user_id, symbol);
create index if not exists idx_notes_user_date on public.journal_notes (user_id, note_date desc);

-- ── Done! ────────────────────────────────────────────────────
-- Your tables are ready. Now:
-- 1. Go to Authentication → Providers → Enable Google OAuth
-- 2. Add your Google Client ID and Secret from Google Cloud Console
-- 3. Set Redirect URL in Google Console to:
--    https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback
-- ============================================================
