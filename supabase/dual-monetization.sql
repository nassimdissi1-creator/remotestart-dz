-- RemoteStart-DZ dual monetization schema
-- Run against the production Supabase project once.

create extension if not exists pgcrypto;

alter table public.talents
  add column if not exists is_pro boolean not null default false,
  add column if not exists featured_until timestamptz,
  add column if not exists ai_cv_reviews_remaining integer not null default 0;

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_type text not null check (customer_type in ('talent','employer')),
  customer_id uuid,
  customer_email text not null,
  product_code text not null check (product_code in ('talent_pro','ai_cv_review','job_standard','job_featured')),
  amount_usd numeric(10,2) not null check (amount_usd > 0),
  payment_method text not null check (payment_method in ('redotpay','baridimob')),
  status text not null default 'pending' check (status in ('pending','paid','failed','expired','refunded')),
  provider_payment_id text,
  receipt_path text,
  metadata jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  job_title text not null,
  salary text,
  description text not null,
  contact_email text not null,
  plan text not null check (plan in ('standard','featured')),
  price_usd numeric(10,2) not null check (price_usd in (199,299)),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','expired','refunded')),
  published boolean not null default false,
  featured boolean not null default false,
  payment_order_id uuid references public.payment_orders(id) on delete set null,
  published_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;
alter table public.job_opportunities enable row level security;

revoke all on public.payment_orders from anon, authenticated;
revoke all on public.job_opportunities from anon, authenticated;
grant select on public.job_opportunities to anon, authenticated;

drop policy if exists "Public can view live jobs" on public.job_opportunities;
create policy "Public can view live jobs" on public.job_opportunities
  for select to anon, authenticated
  using (published = true and payment_status = 'paid');

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false)
on conflict (id) do nothing;
