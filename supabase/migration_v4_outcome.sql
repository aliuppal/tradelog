-- ============================================================
-- TradeLog — Migration v4: Trade outcome (TP / SL / BE)
-- Run this in Supabase SQL Editor
-- ============================================================

alter table public.trades
  add column if not exists outcome text
  check (outcome in ('TP', 'SL', 'BE') or outcome is null);

create index if not exists trades_user_outcome_idx
  on public.trades (user_id, outcome);
