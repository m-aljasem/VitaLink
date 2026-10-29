-- VitaLink security hardening
-- Run this in the Supabase SQL Editor after schema.sql (safe to re-run).
--
-- 1. Provider links can only be created by redeeming a valid code through
--    redeem_link_token(); neither providers nor patients can insert links directly.
--    (Previously a provider could re-insert a revoked link with every share flag on.)
-- 2. Codes are generated server-side, unique among active codes, single-use,
--    and not readable by anyone except the issuing provider.
-- 3. Failed redemptions are rate limited per user.
-- 4. Identity columns (profiles.id/email, provider_links.provider_id/patient_id)
--    cannot be changed through UPDATE.

-- ---------------------------------------------------------------------------
-- provider_links: no direct inserts
-- ---------------------------------------------------------------------------
drop policy if exists "providers create links" on public.provider_links;
drop policy if exists "patients create links" on public.provider_links;

create or replace function public.provider_links_lock_identity()
returns trigger
language plpgsql
as $$
begin
  if new.provider_id <> old.provider_id
     or new.patient_id <> old.patient_id
     or new.created_at is distinct from old.created_at then
    raise exception 'provider_id, patient_id and created_at cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists provider_links_lock_identity on public.provider_links;
create trigger provider_links_lock_identity
  before update on public.provider_links
  for each row execute function public.provider_links_lock_identity();

-- ---------------------------------------------------------------------------
-- profiles: email must match the signed-in account and cannot be changed
-- ---------------------------------------------------------------------------
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert
  with check (id = auth.uid() and email = auth.jwt() ->> 'email');

create or replace function public.profiles_lock_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.email <> old.email
     or new.created_at is distinct from old.created_at then
    raise exception 'id, email and created_at cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_lock_identity on public.profiles;
create trigger profiles_lock_identity
  before update on public.profiles
  for each row execute function public.profiles_lock_identity();

-- ---------------------------------------------------------------------------
-- link_tokens: only the issuing provider can see its tokens; created via RPC
-- ---------------------------------------------------------------------------
drop policy if exists "anyone can verify token" on public.link_tokens;
drop policy if exists "authenticated users can verify tokens" on public.link_tokens;
drop policy if exists "provider create token" on public.link_tokens;
drop policy if exists "provider see tokens" on public.link_tokens;
drop policy if exists "provider delete tokens" on public.link_tokens;

create policy "provider see tokens" on public.link_tokens for select
  using (provider_id = auth.uid());
create policy "provider delete tokens" on public.link_tokens for delete
  using (provider_id = auth.uid());

-- Codes must be unique among unused tokens (the old constraint was per provider only).
delete from public.link_tokens where expires_at <= now() or used;
alter table public.link_tokens drop constraint if exists link_tokens_provider_id_code_key;
create unique index if not exists link_tokens_active_code_idx
  on public.link_tokens (code) where not used;

create table if not exists public.link_redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists link_redeem_attempts_user_idx
  on public.link_redeem_attempts (user_id, attempted_at desc);
alter table public.link_redeem_attempts enable row level security;
-- No policies: only the security-definer functions below touch this table.

create or replace function public.create_link_token()
returns public.link_tokens
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_token public.link_tokens;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Free up codes held by expired tokens.
  delete from public.link_tokens where expires_at <= now() and not used;
  -- A provider has at most one active code at a time.
  delete from public.link_tokens where provider_id = v_uid and not used;

  loop
    -- gen_random_uuid() uses a cryptographically secure source.
    v_code := (100000 + (('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))::bit(32)::bigint % 900000))::text;
    begin
      insert into public.link_tokens (provider_id, code, expires_at, used)
      values (v_uid, v_code, now() + interval '15 minutes', false)
      returning * into v_token;
      exit;
    exception when unique_violation then
      -- Code collided with another active code; try again.
    end;
  end loop;

  return v_token;
end;
$$;

create or replace function public.redeem_link_token(
  p_code text,
  p_share_bp boolean default false,
  p_share_glucose boolean default false,
  p_share_spo2 boolean default false,
  p_share_hr boolean default false,
  p_share_pain boolean default false,
  p_share_weight boolean default false
)
returns public.provider_links
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_token public.link_tokens;
  v_link public.provider_links;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if (select count(*) from public.link_redeem_attempts
      where user_id = v_uid and attempted_at > now() - interval '15 minutes') >= 10 then
    raise exception 'too_many_attempts';
  end if;

  select * into v_token
  from public.link_tokens
  where code = p_code and not used and expires_at > now()
  limit 1
  for update;

  if not found or v_token.provider_id = v_uid then
    -- Record the failure and return null (raising would roll the insert back).
    insert into public.link_redeem_attempts (user_id) values (v_uid);
    return null;
  end if;

  insert into public.provider_links (
    provider_id, patient_id,
    share_bp, share_glucose, share_spo2, share_hr, share_pain, share_weight
  )
  values (
    v_token.provider_id, v_uid,
    p_share_bp, p_share_glucose, p_share_spo2, p_share_hr, p_share_pain, p_share_weight
  )
  on conflict (provider_id, patient_id) do update set
    share_bp = excluded.share_bp,
    share_glucose = excluded.share_glucose,
    share_spo2 = excluded.share_spo2,
    share_hr = excluded.share_hr,
    share_pain = excluded.share_pain,
    share_weight = excluded.share_weight
  returning * into v_link;

  update public.link_tokens set used = true where id = v_token.id;

  return v_link;
end;
$$;

revoke all on function public.create_link_token() from public, anon;
revoke all on function public.redeem_link_token(text, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.create_link_token() to authenticated;
grant execute on function public.redeem_link_token(text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Input limits enforced in the database, not only in the app.
-- NOT VALID: applies to new and updated rows without rejecting existing data.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_age_range;
alter table public.profiles add constraint profiles_age_range
  check (age is null or age between 0 and 130) not valid;

alter table public.profiles drop constraint if exists profiles_text_lengths;
alter table public.profiles add constraint profiles_text_lengths check (
  coalesce(length(first_name), 0) <= 100
  and coalesce(length(last_name), 0) <= 100
  and coalesce(length(city), 0) <= 100
  and coalesce(length(country), 0) <= 100
  and coalesce(length(hospital), 0) <= 200
  and coalesce(array_length(conditions, 1), 0) <= 50
) not valid;

alter table public.profiles drop constraint if exists profiles_height_range;
alter table public.profiles add constraint profiles_height_range
  check (height_cm is null or height_cm between 30 and 300) not valid;

alter table public.reminders drop constraint if exists reminders_title_length;
alter table public.reminders add constraint reminders_title_length
  check (length(title) <= 200) not valid;
