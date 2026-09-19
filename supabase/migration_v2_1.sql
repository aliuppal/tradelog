-- Migration v2.1 — add purchase_price to funded_accounts
-- Run this in Supabase SQL Editor if you already ran schema_v2.sql
alter table public.funded_accounts
  add column if not exists purchase_price numeric(10,2);
