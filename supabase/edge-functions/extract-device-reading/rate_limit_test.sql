-- Run only against a disposable PostgreSQL/Supabase test database after rate_limit.sql.
-- A plain PostgreSQL fixture needs roles anon/authenticated/service_role (BYPASSRLS),
-- schema auth, and table auth.users(id uuid primary key). All test rows roll back.
begin;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_result jsonb;
  v_count integer;
begin
  assert not has_function_privilege('anon', 'public.consume_device_photo_quota(uuid)', 'EXECUTE');
  assert not has_function_privilege('authenticated', 'public.consume_device_photo_quota(uuid)', 'EXECUTE');
  assert has_function_privilege('service_role', 'public.consume_device_photo_quota(uuid)', 'EXECUTE');
  assert not has_table_privilege('anon', 'public.device_photo_quotas', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.device_photo_quotas', 'INSERT');
  assert (select relrowsecurity from pg_class where oid = 'public.device_photo_quotas'::regclass);

  insert into auth.users(id) values (v_user), (v_other);
  for i in 1..5 loop
    v_result := public.consume_device_photo_quota(v_user);
    assert (v_result ->> 'allowed')::boolean, 'First five requests must be allowed';
  end loop;
  v_result := public.consume_device_photo_quota(v_user);
  assert not (v_result ->> 'allowed')::boolean, 'Sixth request must be denied';
  assert (v_result ->> 'retry_after')::integer between 1 and 60;
  select day_count into v_count from public.device_photo_quotas where user_id = v_user;
  assert v_count = 5, 'Denied requests must not consume additional quota';
  v_result := public.consume_device_photo_quota(v_other);
  assert (v_result ->> 'allowed')::boolean, 'Users have independent quotas';

  update public.device_photo_quotas set minute_start = minute_start - interval '1 minute'
  where user_id = v_user;
  v_result := public.consume_device_photo_quota(v_user);
  assert (v_result ->> 'allowed')::boolean, 'Minute rollover must allow a new attempt';
  select minute_count into v_count from public.device_photo_quotas where user_id = v_user;
  assert v_count = 1;
  select day_count into v_count from public.device_photo_quotas where user_id = v_user;
  assert v_count = 6, 'Minute rollover must preserve the daily count';

  update public.device_photo_quotas set day_count = 30 where user_id = v_user;
  v_result := public.consume_device_photo_quota(v_user);
  assert not (v_result ->> 'allowed')::boolean, 'Daily quota must be enforced';
  assert (v_result ->> 'retry_after')::integer between 1 and 86400;

  update public.device_photo_quotas
  set minute_start = minute_start - interval '1 day', day_start = day_start - interval '1 day'
  where user_id = v_user;
  v_result := public.consume_device_photo_quota(v_user);
  assert (v_result ->> 'allowed')::boolean, 'UTC day rollover must reset both counters';
  select day_count into v_count from public.device_photo_quotas where user_id = v_user;
  assert v_count = 1;

  delete from auth.users where id = v_user;
  assert not exists (select 1 from public.device_photo_quotas where user_id = v_user),
    'Deleting an account must cascade to its quota metadata';
end;
$$;

rollback;
