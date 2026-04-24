-- Report Genie — Supabase schema
-- Region: ap-southeast-2 (Sydney)
-- IMPORTANT: This database holds NO student PII.
-- All student data lives in IndexedDB on the teacher's browser.

-- ============================================================================
-- Email allowlist — gates magic link signup
-- ============================================================================

create table if not exists email_allowlist (
  email text primary key,
  added_at timestamptz default now(),
  notes text
);

-- ============================================================================
-- Master statement bank
-- ============================================================================

create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  stages int[] not null,                          -- array of stage numbers, e.g. {1,2}
  subject text not null check (subject in ('English', 'Maths', 'General')),
  category text not null,                         -- e.g. 'Writing', 'Number and Algebra', 'Disposition'
  subcategory text,                               -- e.g. 'Strengths', 'Goals', 'Resilience'
  content text not null,                          -- the statement itself, with {first_name} placeholder
  position int default 0,                         -- ordering within category
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_statements_lookup
  on statements (subject, category, subcategory);

-- ============================================================================
-- System prompts (one per subject, editable)
-- ============================================================================

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  subject text not null unique check (subject in ('English', 'Maths', 'General')),
  content text not null,
  word_count_min int not null default 100,
  word_count_max int not null default 150,
  updated_at timestamptz default now()
);

-- ============================================================================
-- Style guides (one per subject)
-- ============================================================================

create table if not exists style_guides (
  id uuid primary key default gen_random_uuid(),
  subject text not null unique check (subject in ('English', 'Maths', 'General')),
  content text not null,
  updated_at timestamptz default now()
);

-- ============================================================================
-- Exemplars (multiple per subject, keyed by archetype)
-- ============================================================================

create table if not exists exemplars (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('English', 'Maths', 'General')),
  archetype text not null,                        -- e.g. 'strong_all_rounder', 'working_towards', 'eald_emerging'
  stage int,                                      -- nullable; null = applies to all stages
  content text not null,
  notes text,                                     -- internal notes about when to use this exemplar
  updated_at timestamptz default now(),
  unique (subject, archetype, stage)
);

-- ============================================================================
-- Per-teacher overrides
-- A teacher can edit any statement, prompt, style guide, or exemplar.
-- Overrides shadow the master record but don't change it.
-- ============================================================================

create table if not exists teacher_overrides (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  table_name text not null check (table_name in ('statements', 'prompts', 'style_guides', 'exemplars')),
  record_id uuid not null,                        -- the master record being overridden
  override_content text not null,
  -- For statements only: allow teachers to add new statements (record_id is then a self-generated uuid)
  is_custom boolean default false,
  custom_subject text,
  custom_category text,
  custom_subcategory text,
  custom_stages int[],
  custom_position int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_teacher_overrides_lookup
  on teacher_overrides (teacher_id, table_name);

-- One row per (teacher, table, record). Required so saveOverride can use
-- upsert with onConflict 'teacher_id,table_name,record_id'; a plain index
-- is not enough for Postgres to resolve the ON CONFLICT target.
alter table teacher_overrides
  drop constraint if exists teacher_overrides_unique_override;
alter table teacher_overrides
  add constraint teacher_overrides_unique_override
  unique (teacher_id, table_name, record_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table email_allowlist enable row level security;
alter table statements enable row level security;
alter table prompts enable row level security;
alter table style_guides enable row level security;
alter table exemplars enable row level security;
alter table teacher_overrides enable row level security;

-- Allowlist: only the service role can read it (used by /api/polish for signup gate)
-- No client-side policy: clients cannot query this table directly.

-- Statements, prompts, style guides, exemplars: any authenticated user can read.
create policy "authenticated can read statements" on statements
  for select using (auth.role() = 'authenticated');

create policy "authenticated can read prompts" on prompts
  for select using (auth.role() = 'authenticated');

create policy "authenticated can read style_guides" on style_guides
  for select using (auth.role() = 'authenticated');

create policy "authenticated can read exemplars" on exemplars
  for select using (auth.role() = 'authenticated');

-- Teacher overrides: each teacher can only see and modify their own.
create policy "teachers manage own overrides" on teacher_overrides
  for all using (auth.uid() = teacher_id) with check (auth.uid() = teacher_id);

-- ============================================================================
-- Updated-at trigger (DRY)
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger statements_updated_at before update on statements
  for each row execute function set_updated_at();
create trigger prompts_updated_at before update on prompts
  for each row execute function set_updated_at();
create trigger style_guides_updated_at before update on style_guides
  for each row execute function set_updated_at();
create trigger exemplars_updated_at before update on exemplars
  for each row execute function set_updated_at();
create trigger teacher_overrides_updated_at before update on teacher_overrides
  for each row execute function set_updated_at();

-- ============================================================================
-- Signup allowlist trigger
-- Rejects auth.users inserts whose email is not in email_allowlist.
-- SECURITY DEFINER so the function bypasses RLS on email_allowlist.
-- ============================================================================

create or replace function check_email_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from email_allowlist
    where lower(email) = lower(new.email)
  ) then
    raise exception 'Email address is not on the Report Genie allowlist. Contact the administrator to be added.'
      using errcode = '42501';  -- insufficient_privilege
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_email_allowlist on auth.users;
create trigger enforce_email_allowlist
  before insert on auth.users
  for each row execute function check_email_allowlist();
