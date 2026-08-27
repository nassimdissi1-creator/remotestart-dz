create or replace function public.consume_ai_cv_review(p_talent_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_talent public.talents%rowtype;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_limit integer;
  v_remaining integer;
begin
  select * into v_talent
  from public.talents
  where id = p_talent_id
  for update;

  if not found then raise exception 'talent_not_found'; end if;
  if coalesce(v_talent.is_pro, false) is not true then raise exception 'talent_pro_required'; end if;

  select ai_cv_reviews_per_month into v_limit
  from public.billing_plans
  where code = 'talent_pro' and audience = 'talent' and is_active = true
  limit 1;

  v_limit := coalesce(v_limit, 5);
  v_period_start := coalesce(v_talent.ai_cv_reviews_period_start, now());
  v_period_end := coalesce(v_talent.ai_cv_reviews_period_end, v_period_start + interval '1 month');

  if now() >= v_period_end then
    v_period_start := now();
    v_period_end := now() + interval '1 month';
    v_remaining := v_limit - 1;
  else
    v_remaining := coalesce(v_talent.ai_cv_reviews_remaining, v_limit);
    if v_remaining <= 0 then raise exception 'ai_cv_review_limit_reached'; end if;
    v_remaining := v_remaining - 1;
  end if;

  update public.talents
  set ai_cv_reviews_remaining = v_remaining,
      ai_cv_reviews_period_start = v_period_start,
      ai_cv_reviews_period_end = v_period_end
  where id = p_talent_id;

  return jsonb_build_object('success', true, 'remaining', v_remaining, 'period_start', v_period_start, 'period_end', v_period_end);
end;
$$;

revoke all on function public.consume_ai_cv_review(uuid) from public;
grant execute on function public.consume_ai_cv_review(uuid) to service_role;
