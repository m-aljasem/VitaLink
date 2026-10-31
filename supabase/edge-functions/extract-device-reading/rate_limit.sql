-- Apply once with an administrative connection before deploying the function.
-- Only quota metadata is stored: no photos, readings, or provider responses.
begin;

create table if not exists public.device_photo_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_start timestamptz not null,
  minute_count integer not null check (minute_count between 0 and 5),
  day_start timestamptz not null,
  day_count integer not null check (day_count between 0 and 30)
);

alter table public.device_photo_quotas enable row level security;
-- No browser/client RLS policies. Only the server service role may access this table.
revoke all on table public.device_photo_quotas from public, anon, authenticated;
grant select, insert, update, delete on table public.device_photo_quotas to service_role;

create or replace function public.consume_device_photo_quota(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_minute timestamptz := pg_catalog.date_trunc('minute', v_now);
  v_day timestamptz := pg_catalog.date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_bucket public.device_photo_quotas%rowtype;
  v_minute_count integer;
  v_day_count integer;
  v_retry integer := 0;
begin
  if p_user_id is null then
    raise exception 'User ID required';
  end if;

  insert into public.device_photo_quotas (user_id, minute_start, minute_count, day_start, day_count)
  values (p_user_id, v_minute, 0, v_day, 0)
  on conflict (user_id) do nothing;

  select * into strict v_bucket from public.device_photo_quotas
  where user_id = p_user_id for update;

  -- A request may have waited on another transaction across a window boundary.
  v_now := pg_catalog.clock_timestamp();
  v_minute := pg_catalog.date_trunc('minute', v_now);
  v_day := pg_catalog.date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';

  v_minute_count := case when v_bucket.minute_start = v_minute then v_bucket.minute_count else 0 end;
  v_day_count := case when v_bucket.day_start = v_day then v_bucket.day_count else 0 end;

  if v_minute_count >= 5 then
    v_retry := greatest(1, ceil(extract(epoch from (v_minute + interval '1 minute' - v_now)))::integer);
  end if;
  if v_day_count >= 30 then
    v_retry := greatest(v_retry, 1, ceil(extract(epoch from (v_day + interval '1 day' - v_now)))::integer);
  end if;
  if v_retry > 0 then
    return pg_catalog.jsonb_build_object('allowed', false, 'retry_after', v_retry);
  end if;

  update public.device_photo_quotas
  set minute_start = v_minute, minute_count = v_minute_count + 1,
      day_start = v_day, day_count = v_day_count + 1
  where user_id = p_user_id;

  return pg_catalog.jsonb_build_object('allowed', true, 'retry_after', 0);
end;
$$;

revoke all on function public.consume_device_photo_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_device_photo_quota(uuid) to service_role;

commit;
