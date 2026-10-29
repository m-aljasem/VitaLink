-- =============================================================================
-- VitaLink — complete database setup
--
-- Run this whole file once in the Supabase SQL Editor of a new project.
-- It is safe to re-run: every statement is idempotent.
--
-- Contents
--   1. Types
--   2. Tables and indexes
--   3. Integrity triggers
--   4. Row Level Security policies
--   5. Provider linking functions (create / redeem 6-digit codes)
--   6. Grants
--   7. Realtime
--
-- Also configure in the dashboard (not possible from SQL):
--   - Authentication → Providers → Email: enable, and use a 6-digit OTP
--     (email template must contain {{ .Token }}; see supabase/email-templates)
--   - Authentication → Rate Limits: keep OTP email limits enabled
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Types
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.role_type as enum ('patient', 'provider');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.provider_kind as enum ('doctor', 'nurse', 'family', 'friend', 'caregiver');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.metric_type as enum ('bp', 'glucose', 'spo2', 'hr', 'pain', 'weight');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- 2. Tables and indexes
-- -----------------------------------------------------------------------------

-- User profiles (one per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.role_type not null,
  language text not null default 'en',
  first_name text,
  last_name text,
  age int,
  gender text check (gender in ('male', 'female')),
  country text,
  city text,
  provider_kind public.provider_kind,
  hospital text,
  conditions text[] default '{}',
  height_cm numeric,
  created_at timestamptz default now(),
  constraint profiles_age_range check (age is null or age between 0 and 130),
  constraint profiles_height_range check (height_cm is null or height_cm between 30 and 300),
  constraint profiles_text_lengths check (
    coalesce(length(first_name), 0) <= 100
    and coalesce(length(last_name), 0) <= 100
    and coalesce(length(city), 0) <= 100
    and coalesce(length(country), 0) <= 100
    and coalesce(length(hospital), 0) <= 200
    and coalesce(array_length(conditions, 1), 0) <= 50
  )
);

-- Provider ↔ patient link, with the patient's per-metric sharing choices
create table if not exists public.provider_links (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  share_bp boolean default false,
  share_glucose boolean default false,
  share_spo2 boolean default false,
  share_hr boolean default false,
  share_pain boolean default false,
  share_weight boolean default false,
  created_at timestamptz default now(),
  unique (provider_id, patient_id)
);
create index if not exists provider_links_patient_idx on public.provider_links (patient_id);

-- 6-digit, single-use, 15-minute link codes issued by providers
create table if not exists public.link_tokens (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now()
);
-- A code is unique among codes that can still be redeemed.
create unique index if not exists link_tokens_active_code_idx
  on public.link_tokens (code) where not used;
create index if not exists link_tokens_provider_idx on public.link_tokens (provider_id);

-- Failed code redemptions, for rate limiting (no client access)
create table if not exists public.link_redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists link_redeem_attempts_user_idx
  on public.link_redeem_attempts (user_id, attempted_at desc);

-- Health readings (patient-generated health data)
create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric public.metric_type not null,
  ts timestamptz not null default now(),
  -- blood pressure uses systolic/diastolic; every other metric uses numeric_value
  systolic smallint,
  diastolic smallint,
  numeric_value numeric,
  unit text,
  tags text[] default '{}',
  context jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists observations_user_metric_ts_idx
  on public.observations (user_id, metric, ts desc);
create index if not exists observations_user_ts_idx
  on public.observations (user_id, ts desc);

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  schedule_cron text, -- reserved for server-side scheduling
  local_time time,
  days text[], -- e.g. {'Mon','Wed'}
  enabled boolean default true,
  created_at timestamptz default now(),
  constraint reminders_title_length check (length(title) <= 200)
);
create index if not exists reminders_user_idx on public.reminders (user_id);

-- Audit log of provider views (reserved; not written by the app yet)
create table if not exists public.audit_views (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  metric public.metric_type not null,
  viewed_at timestamptz default now()
);


-- -----------------------------------------------------------------------------
-- 3. Integrity triggers
-- -----------------------------------------------------------------------------

-- A link's provider and patient can never be changed (only sharing flags).
create or replace function public.provider_links_lock_identity()
returns trigger
language plpgsql
set search_path = public
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

-- A profile's id and email can never be changed.
create or replace function public.profiles_lock_identity()
returns trigger
language plpgsql
set search_path = public
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


-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.provider_links enable row level security;
alter table public.link_tokens enable row level security;
alter table public.link_redeem_attempts enable row level security; -- no policies: functions only
alter table public.observations enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_views enable row level security;

-- profiles
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for select
  using (id = auth.uid());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert
  with check (id = auth.uid() and email = auth.jwt() ->> 'email');

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update
  using (id = auth.uid());

drop policy if exists "providers see linked patients" on public.profiles;
create policy "providers see linked patients" on public.profiles for select
  using (exists (
    select 1 from public.provider_links pl
    where pl.provider_id = auth.uid() and pl.patient_id = profiles.id
  ));

drop policy if exists "patients see linked providers" on public.profiles;
create policy "patients see linked providers" on public.profiles for select
  using (exists (
    select 1 from public.provider_links pl
    where pl.patient_id = auth.uid() and pl.provider_id = profiles.id
  ));

-- observations
drop policy if exists "own observations" on public.observations;
create policy "own observations" on public.observations for select
  using (user_id = auth.uid());

drop policy if exists "insert own observations" on public.observations;
create policy "insert own observations" on public.observations for insert
  with check (user_id = auth.uid());

drop policy if exists "update own observations" on public.observations;
create policy "update own observations" on public.observations for update
  using (user_id = auth.uid());

drop policy if exists "delete own observations" on public.observations;
create policy "delete own observations" on public.observations for delete
  using (user_id = auth.uid());

drop policy if exists "provider can see shared observations" on public.observations;
create policy "provider can see shared observations" on public.observations for select
  using (exists (
    select 1 from public.provider_links pl
    where pl.provider_id = auth.uid() and pl.patient_id = observations.user_id
      and (
        (observations.metric = 'bp' and pl.share_bp) or
        (observations.metric = 'glucose' and pl.share_glucose) or
        (observations.metric = 'spo2' and pl.share_spo2) or
        (observations.metric = 'hr' and pl.share_hr) or
        (observations.metric = 'pain' and pl.share_pain) or
        (observations.metric = 'weight' and pl.share_weight)
      )
  ));

-- provider_links: no INSERT policy — links are created only by redeem_link_token()
drop policy if exists "providers own links" on public.provider_links;
create policy "providers own links" on public.provider_links for select
  using (provider_id = auth.uid());

drop policy if exists "patients see who can access" on public.provider_links;
create policy "patients see who can access" on public.provider_links for select
  using (patient_id = auth.uid());

drop policy if exists "patient update sharing toggles" on public.provider_links;
create policy "patient update sharing toggles" on public.provider_links for update
  using (patient_id = auth.uid());

drop policy if exists "provider or patient delete links" on public.provider_links;
create policy "provider or patient delete links" on public.provider_links for delete
  using (provider_id = auth.uid() or patient_id = auth.uid());

-- link_tokens: no INSERT policy — codes are created only by create_link_token()
drop policy if exists "provider see tokens" on public.link_tokens;
create policy "provider see tokens" on public.link_tokens for select
  using (provider_id = auth.uid());

drop policy if exists "provider delete tokens" on public.link_tokens;
create policy "provider delete tokens" on public.link_tokens for delete
  using (provider_id = auth.uid());

-- reminders
drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- audit_views
drop policy if exists "own audit views" on public.audit_views;
create policy "own audit views" on public.audit_views for all
  using (provider_id = auth.uid())
  with check (provider_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 5. Provider linking functions
-- -----------------------------------------------------------------------------

-- Issues a new 6-digit code for the signed-in provider (replacing any active one).
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
      -- Collided with another active code; try again.
    end;
  end loop;

  return v_token;
end;
$$;

-- Redeems a code for the signed-in patient and creates (or updates) the link
-- with the patient's sharing choices. Returns null for an invalid/expired code;
-- raises 'too_many_attempts' after 10 failures in 15 minutes.
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


-- -----------------------------------------------------------------------------
-- 6. Grants
-- -----------------------------------------------------------------------------
-- Table access is controlled by RLS above; signed-out users get nothing.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on
  public.profiles, public.provider_links, public.link_tokens,
  public.observations, public.reminders, public.audit_views
  to authenticated;
revoke all on public.link_redeem_attempts from anon, authenticated;

revoke all on function public.create_link_token() from public, anon;
revoke all on function public.redeem_link_token(text, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.create_link_token() to authenticated;
grant execute on function public.redeem_link_token(text, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- 7. Realtime
-- -----------------------------------------------------------------------------
-- The provider "Connect" screen listens for code redemption and new links.
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['link_tokens', 'provider_links'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
