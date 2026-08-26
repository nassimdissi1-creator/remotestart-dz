-- RemoteStart-DZ canonical billing catalog
--
-- Products:
--   talent_free   : 0 DZD/month
--   talent_pro    : 8000 DZD/month locally, 29 USD on RedotPay
--   job_standard  : 399 USD one-time
--   job_featured  : 499 USD one-time
--
-- AI CV Review is NOT a product. It is a 5-review/subscription-period
-- entitlement included in Talent Pro Plus.
-- Employer Success Fee is intentionally not part of the platform catalog.

create extension if not exists pgcrypto;

alter table public.talents
  add column if not exists is_pro boolean not null default false,
  add column if not exists featured_until timestamptz,
  add column if not exists ai_cv_reviews_remaining integer not null default 0,
  add column if not exists ai_cv_reviews_period_start timestamptz,
  add column if not exists ai_cv_reviews_period_end timestamptz;

alter table public.payment_orders drop constraint if exists payment_orders_product_code_check;
alter table public.payment_orders add constraint payment_orders_product_code_check
  check (product_code = any (array['talent_pro'::text,'job_standard'::text,'job_featured'::text]));

insert into public.billing_plans
  (code,name,description,audience,price_amount,currency,billing_interval,is_active,ai_cv_reviews_per_month)
values
  ('talent_free','Talent Free','Free talent plan with limited job applications','talent',0,'DZD','monthly',true,0),
  ('talent_pro','Talent Pro Plus','Premium talent plan with unlimited applications, profile visibility, AI CV Review and priority support','talent',8000,'DZD','monthly',true,5),
  ('job_standard','Standard Job Post','One-time payment for a standard job posting','employer',399,'USD','one_time',true,0),
  ('job_featured','Featured Job Post','One-time payment for a featured job posting','employer',499,'USD','one_time',true,0)
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  audience=excluded.audience,
  price_amount=excluded.price_amount,
  currency=excluded.currency,
  billing_interval=excluded.billing_interval,
  is_active=excluded.is_active,
  ai_cv_reviews_per_month=excluded.ai_cv_reviews_per_month,
  updated_at=now();

insert into public.billing_entitlements (code,name,description,unit)
values ('ai_cv_review','AI CV Review','AI-powered CV review included with Talent Pro Plus','review')
on conflict (code) do update set
  name=excluded.name,
  description=excluded.description,
  unit=excluded.unit;

insert into public.billing_plan_entitlements
  (plan_id,entitlement_id,enabled,limit_value,reset_period)
select bp.id,be.id,true,5,'subscription'
from public.billing_plans bp
cross join public.billing_entitlements be
where bp.code='talent_pro' and be.code='ai_cv_review'
on conflict (plan_id,entitlement_id) do update set
  enabled=true,
  limit_value=5,
  reset_period='subscription';

insert into public.billing_plan_entitlements
  (plan_id,entitlement_id,enabled,limit_value,reset_period)
select bp.id,be.id,false,0,'subscription'
from public.billing_plans bp
cross join public.billing_entitlements be
where bp.code='talent_free' and be.code='ai_cv_review'
on conflict (plan_id,entitlement_id) do update set
  enabled=false,
  limit_value=0,
  reset_period='subscription';

alter table public.job_opportunities drop constraint if exists job_opportunities_price_usd_check;
alter table public.job_opportunities add constraint job_opportunities_price_usd_check
  check (price_usd = any (array[399::numeric,499::numeric]));
