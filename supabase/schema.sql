-- VitaLink Database Schema
-- Run this in Supabase SQL Editor

-- ENUMS
create type role_type as enum ('patient','provider');
create type provider_kind as enum ('doctor','nurse','family','friend','caregiver');
create type metric_type as enum ('bp','glucose','spo2','hr','pain','weight');

-- USERS/PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role role_type not null,
  language text not null default 'en',
  first_name text,
  last_name text,
  age int,
  gender text check (gender in ('male','female')),
  country text,
  city text,
  provider_kind provider_kind,
  hospital text,
  conditions text[] default '{}',
  height_cm numeric,
  created_at timestamptz default now()
);

-- PROVIDER↔PATIENT LINK + SHARING SCOPE
create table public.provider_links (
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
  unique(provider_id, patient_id)
);

-- 6-DIGIT CODES (TIME-LIMITED)
create table public.link_tokens (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used boolean default false,
  created_at timestamptz default now(),
  unique(provider_id, code)
);

-- OBSERVATIONS (PGHD)
create table public.observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric metric_type not null,
  ts timestamptz not null default now(),
  -- values (use columns appropriate to metric)
  systolic smallint,
  diastolic smallint,
  numeric_value numeric,
  unit text,
  tags text[] default '{}',
  context jsonb default '{}',
  created_at timestamptz default now()
);
create index on public.observations(user_id, metric, ts desc);

-- REMINDERS
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  schedule_cron text, -- optional server-based scheduling
  local_time time,
  days text[], -- e.g., ['Mon','Wed']
  enabled boolean default true,
  created_at timestamptz default now()
);

-- AUDIT LOG (views by providers)
create table public.audit_views (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references auth.users(id) on delete cascade,
  patient_id uuid not null references auth.users(id) on delete cascade,
  metric metric_type not null,
  viewed_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.provider_links enable row level security;
alter table public.link_tokens enable row level security;
alter table public.observations enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_views enable row level security;

-- RLS Policies
create policy "own profile" on public.profiles for select using (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid());
create policy "insert own profile" on public.profiles for insert with check (id = auth.uid());

create policy "own observations" on public.observations for select using (user_id = auth.uid());
create policy "insert own observations" on public.observations for insert with check (user_id = auth.uid());
create policy "update own observations" on public.observations for update using (user_id = auth.uid());
create policy "delete own observations" on public.observations for delete using (user_id = auth.uid());

-- Provider can see shared observations
create policy "provider can see shared observations" on public.observations for select using (
  exists (
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
  )
);

create policy "providers own links" on public.provider_links for select using (provider_id = auth.uid());
create policy "providers create links" on public.provider_links for insert with check (provider_id = auth.uid());
create policy "patients see who can access" on public.provider_links for select using (patient_id = auth.uid());
create policy "patient update sharing toggles" on public.provider_links for update using (patient_id = auth.uid());
create policy "provider or patient delete links" on public.provider_links for delete using (provider_id = auth.uid() or patient_id = auth.uid());

create policy "provider create token" on public.link_tokens for insert with check (provider_id = auth.uid());
create policy "provider see tokens" on public.link_tokens for select using (provider_id = auth.uid());
create policy "anyone can verify token" on public.link_tokens for select using (true);

create policy "own reminders" on public.reminders for all using (user_id = auth.uid());

create policy "own audit views" on public.audit_views for all using (provider_id = auth.uid());

