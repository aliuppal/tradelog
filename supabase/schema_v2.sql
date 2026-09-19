-- ============================================================
-- TradeLog — Schema v2 additions
-- Run this in Supabase SQL Editor AFTER schema.sql
-- ============================================================

-- ── Funded Accounts ──────────────────────────────────────────
create table if not exists public.funded_accounts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  company      text not null,          -- e.g. "FTMO", "MyForexFunds"
  account_type text not null,          -- e.g. "Challenge", "Funded", "Evaluation"
  asset_type   text not null,          -- "Futures" | "CFDs" | "Forex" | "Crypto"
  account_size numeric(18,2) not null, -- e.g. 100000
  currency     text default 'USD',

  status       text not null default 'active'
                 check (status in ('active','breached','passed','expired','inactive')),

  start_date   date,
  end_date     date,
  profit_target numeric(5,2),          -- % e.g. 10.00
  max_drawdown  numeric(5,2),          -- % e.g. 5.00
  daily_loss_limit numeric(5,2),       -- % e.g. 2.00

  login_id     text,                   -- account number (optional)
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists funded_accounts_updated_at on public.funded_accounts;
create trigger funded_accounts_updated_at
  before update on public.funded_accounts
  for each row execute function public.set_updated_at();

alter table public.funded_accounts enable row level security;

create policy "fa_select" on public.funded_accounts for select using (auth.uid() = user_id);
create policy "fa_insert" on public.funded_accounts for insert with check (auth.uid() = user_id);
create policy "fa_update" on public.funded_accounts for update using (auth.uid() = user_id);
create policy "fa_delete" on public.funded_accounts for delete using (auth.uid() = user_id);

create index if not exists idx_funded_accounts_user on public.funded_accounts (user_id);

-- ── Live Accounts ─────────────────────────────────────────────
create table if not exists public.live_accounts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references auth.users(id) on delete cascade,

  broker       text not null,          -- "Exness" | "MEXC" | "Binance" | "Bybit" | "Other"
  account_name text,                   -- friendly label
  account_size numeric(18,2),
  currency     text default 'USD',
  asset_type   text,                   -- "Futures" | "Spot" | "CFDs" | "Forex"
  is_active    boolean default true,
  notes        text,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists live_accounts_updated_at on public.live_accounts;
create trigger live_accounts_updated_at
  before update on public.live_accounts
  for each row execute function public.set_updated_at();

alter table public.live_accounts enable row level security;

create policy "la_select" on public.live_accounts for select using (auth.uid() = user_id);
create policy "la_insert" on public.live_accounts for insert with check (auth.uid() = user_id);
create policy "la_update" on public.live_accounts for update using (auth.uid() = user_id);
create policy "la_delete" on public.live_accounts for delete using (auth.uid() = user_id);

-- ── Live Account Logs ─────────────────────────────────────────
create table if not exists public.live_account_logs (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  account_id    uuid not null references public.live_accounts(id) on delete cascade,

  log_date      date not null,
  pnl           numeric(18,2) not null default 0,
  note          text,

  created_at    timestamptz not null default now()
);

alter table public.live_account_logs enable row level security;

create policy "lal_select" on public.live_account_logs for select using (auth.uid() = user_id);
create policy "lal_insert" on public.live_account_logs for insert with check (auth.uid() = user_id);
create policy "lal_update" on public.live_account_logs for update using (auth.uid() = user_id);
create policy "lal_delete" on public.live_account_logs for delete using (auth.uid() = user_id);

create index if not exists idx_live_accounts_user on public.live_accounts (user_id);
create index if not exists idx_live_logs_account on public.live_account_logs (account_id, log_date desc);
