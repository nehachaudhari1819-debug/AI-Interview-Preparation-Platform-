-- Migration 17: Question Bank Tables
-- Sets up taxonomy tables, questions, internal data, mappings, RLS, and constraints.

-- 1. Types
create type public.question_status_enum as enum ('draft', 'published', 'archived');

-- 2. Taxonomies
create table if not exists public.question_categories (
  id uuid primary key default gen_random_uuid(),
  slug varchar(100) not null,
  name varchar(100) not null,
  description varchar(500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_question_categories_lower_slug on public.question_categories (lower(slug));
create unique index idx_question_categories_lower_name on public.question_categories (lower(name));

create table if not exists public.question_difficulties (
  id uuid primary key default gen_random_uuid(),
  slug varchar(100) not null,
  name varchar(100) not null,
  description varchar(500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_question_difficulties_lower_slug on public.question_difficulties (lower(slug));
create unique index idx_question_difficulties_lower_name on public.question_difficulties (lower(name));

create table if not exists public.question_interview_types (
  id uuid primary key default gen_random_uuid(),
  slug varchar(100) not null,
  name varchar(100) not null,
  description varchar(500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_question_interview_types_lower_slug on public.question_interview_types (lower(slug));
create unique index idx_question_interview_types_lower_name on public.question_interview_types (lower(name));

create table if not exists public.question_skills (
  id uuid primary key default gen_random_uuid(),
  slug varchar(100) not null,
  name varchar(100) not null,
  description varchar(500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_question_skills_lower_slug on public.question_skills (lower(slug));
create unique index idx_question_skills_lower_name on public.question_skills (lower(name));

create table if not exists public.question_topics (
  id uuid primary key default gen_random_uuid(),
  slug varchar(100) not null,
  name varchar(100) not null,
  description varchar(500),
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_question_topics_lower_slug on public.question_topics (lower(slug));
create unique index idx_question_topics_lower_name on public.question_topics (lower(name));

-- 3. Questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_text text not null check (char_length(trim(question_text)) between 10 and 2000),
  category_id uuid not null references public.question_categories(id) on delete restrict,
  difficulty_id uuid not null references public.question_difficulties(id) on delete restrict,
  interview_type_id uuid not null references public.question_interview_types(id) on delete restrict,
  status public.question_status_enum not null default 'draft',
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  archived_at timestamptz,
  question_text_search tsvector generated always as (to_tsvector('english'::regconfig, question_text)) stored
);

create table if not exists public.question_internal_data (
  question_id uuid primary key references public.questions(id) on delete cascade,
  reference_answer text check (char_length(trim(reference_answer)) <= 5000),
  evaluation_guidance text check (char_length(trim(evaluation_guidance)) <= 5000),
  updated_at timestamptz not null default now()
);

-- 4. Mappings
create table if not exists public.question_skill_mappings (
  question_id uuid not null references public.questions(id) on delete cascade,
  skill_id uuid not null references public.question_skills(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (question_id, skill_id)
);

create table if not exists public.question_topic_mappings (
  question_id uuid not null references public.questions(id) on delete cascade,
  topic_id uuid not null references public.question_topics(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (question_id, topic_id)
);

-- 5. Indexes
create index idx_questions_status on public.questions(status);
create index idx_questions_published_at on public.questions(published_at);
create index idx_questions_category_id on public.questions(category_id);
create index idx_questions_difficulty_id on public.questions(difficulty_id);
create index idx_questions_interview_type_id on public.questions(interview_type_id);
create index idx_questions_search on public.questions using gin(question_text_search);

create index idx_question_skill_mappings_skill_id on public.question_skill_mappings(skill_id);
create index idx_question_topic_mappings_topic_id on public.question_topic_mappings(topic_id);

create index idx_question_categories_is_active_order on public.question_categories(is_active, display_order);
create index idx_question_difficulties_is_active_order on public.question_difficulties(is_active, display_order);
create index idx_question_interview_types_is_active_order on public.question_interview_types(is_active, display_order);
create index idx_question_skills_is_active_order on public.question_skills(is_active, display_order);
create index idx_question_topics_is_active_order on public.question_topics(is_active, display_order);

-- 6. Updated At Triggers
create trigger set_question_categories_updated_at before update on public.question_categories for each row when (old.* is distinct from new.*) execute function private.set_updated_at();
create trigger set_question_difficulties_updated_at before update on public.question_difficulties for each row when (old.* is distinct from new.*) execute function private.set_updated_at();
create trigger set_question_interview_types_updated_at before update on public.question_interview_types for each row when (old.* is distinct from new.*) execute function private.set_updated_at();
create trigger set_question_skills_updated_at before update on public.question_skills for each row when (old.* is distinct from new.*) execute function private.set_updated_at();
create trigger set_question_topics_updated_at before update on public.question_topics for each row when (old.* is distinct from new.*) execute function private.set_updated_at();
create trigger set_questions_updated_at before update on public.questions for each row execute function private.set_updated_at();
create trigger set_question_internal_data_updated_at before update on public.question_internal_data for each row when (old.* is distinct from new.*) execute function private.set_updated_at();

-- 7. Immutability
create or replace function private.enforce_question_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at is immutable';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_question_immutable_fields() from public, anon, authenticated;
grant execute on function private.enforce_question_immutable_fields() to service_role;

create trigger trg_enforce_question_immutable_fields
  before update on public.questions
  for each row
  execute function private.enforce_question_immutable_fields();

-- 8. Lifecycle Enforcement
create or replace function private.enforce_question_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status != 'draft' then
      raise exception 'New questions must be draft';
    end if;
    new.published_at = null;
    new.archived_at = null;
    return new;
  end if;

  -- Block client from directly modifying timestamps
  if new.published_at is distinct from old.published_at or new.archived_at is distinct from old.archived_at then
    new.published_at = old.published_at;
    new.archived_at = old.archived_at;
  end if;

  if old.status = 'draft' and new.status = 'published' then
    new.published_at = now();
    new.archived_at = null;
  elsif old.status = 'published' and new.status = 'archived' then
    new.published_at = old.published_at; 
    new.archived_at = now();
  elsif old.status = 'archived' and new.status = 'draft' then
    new.published_at = null;
    new.archived_at = null;
  elsif old.status = new.status then
    new.published_at = old.published_at;
    new.archived_at = old.archived_at;
  else
    raise exception 'Invalid status transition from % to %', old.status, new.status;
  end if;

  return new;
end;
$$;
revoke execute on function private.enforce_question_lifecycle() from public, anon, authenticated;
grant execute on function private.enforce_question_lifecycle() to service_role;

create trigger trg_enforce_question_lifecycle
  before insert or update on public.questions
  for each row
  execute function private.enforce_question_lifecycle();

-- 9. Active Taxonomy Enforcement
create or replace function private.enforce_question_active_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _cat_active boolean;
  _diff_active boolean;
  _type_active boolean;
  _inactive_skill_count integer;
  _inactive_topic_count integer;
begin
  select is_active into _cat_active from public.question_categories where id = new.category_id;
  select is_active into _diff_active from public.question_difficulties where id = new.difficulty_id;
  select is_active into _type_active from public.question_interview_types where id = new.interview_type_id;

  if tg_op = 'INSERT' then
    if not _cat_active then raise exception 'Category must be active'; end if;
    if not _diff_active then raise exception 'Difficulty must be active'; end if;
    if not _type_active then raise exception 'Interview type must be active'; end if;
  end if;

  if new.status = 'published' then
    if not _cat_active then raise exception 'Cannot publish with inactive category'; end if;
    if not _diff_active then raise exception 'Cannot publish with inactive difficulty'; end if;
    if not _type_active then raise exception 'Cannot publish with inactive interview type'; end if;

    select count(*) into _inactive_skill_count from public.question_skill_mappings qsm
      join public.question_skills qs on qs.id = qsm.skill_id
      where qsm.question_id = new.id and qs.is_active = false;
    
    if _inactive_skill_count > 0 then raise exception 'Cannot publish with inactive skills'; end if;

    select count(*) into _inactive_topic_count from public.question_topic_mappings qtm
      join public.question_topics qt on qt.id = qtm.topic_id
      where qtm.question_id = new.id and qt.is_active = false;
    
    if _inactive_topic_count > 0 then raise exception 'Cannot publish with inactive topics'; end if;
  end if;

  return new;
end;
$$;
revoke execute on function private.enforce_question_active_taxonomy() from public, anon, authenticated;
grant execute on function private.enforce_question_active_taxonomy() to service_role;

create trigger trg_enforce_question_active_taxonomy
  before insert or update on public.questions
  for each row
  execute function private.enforce_question_active_taxonomy();

create or replace function private.enforce_mapping_active_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _is_active boolean;
begin
  if tg_table_name = 'question_skill_mappings' then
    select is_active into _is_active from public.question_skills where id = new.skill_id;
    if not _is_active then raise exception 'Skill must be active'; end if;
  elsif tg_table_name = 'question_topic_mappings' then
    select is_active into _is_active from public.question_topics where id = new.topic_id;
    if not _is_active then raise exception 'Topic must be active'; end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_mapping_active_taxonomy() from public, anon, authenticated;
grant execute on function private.enforce_mapping_active_taxonomy() to service_role;

create trigger trg_enforce_skill_mapping_active
  before insert on public.question_skill_mappings
  for each row
  execute function private.enforce_mapping_active_taxonomy();

create trigger trg_enforce_topic_mapping_active
  before insert on public.question_topic_mappings
  for each row
  execute function private.enforce_mapping_active_taxonomy();

-- 10. Archival Restrictions
create or replace function private.prevent_active_taxonomy_archival()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _published_count integer;
begin
  if old.is_active = true and new.is_active = false then
    if tg_table_name = 'question_categories' then
      select count(*) into _published_count from public.questions where category_id = new.id and status = 'published';
    elsif tg_table_name = 'question_difficulties' then
      select count(*) into _published_count from public.questions where difficulty_id = new.id and status = 'published';
    elsif tg_table_name = 'question_interview_types' then
      select count(*) into _published_count from public.questions where interview_type_id = new.id and status = 'published';
    elsif tg_table_name = 'question_skills' then
      select count(*) into _published_count from public.question_skill_mappings qsm
        join public.questions q on q.id = qsm.question_id
        where qsm.skill_id = new.id and q.status = 'published';
    elsif tg_table_name = 'question_topics' then
      select count(*) into _published_count from public.question_topic_mappings qtm
        join public.questions q on q.id = qtm.question_id
        where qtm.topic_id = new.id and q.status = 'published';
    end if;

    if _published_count > 0 then
      raise exception 'Cannot deactivate taxonomy referenced by published questions';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function private.prevent_active_taxonomy_archival() from public, anon, authenticated;
grant execute on function private.prevent_active_taxonomy_archival() to service_role;

create trigger trg_prevent_category_archival before update on public.question_categories for each row execute function private.prevent_active_taxonomy_archival();
create trigger trg_prevent_difficulty_archival before update on public.question_difficulties for each row execute function private.prevent_active_taxonomy_archival();
create trigger trg_prevent_interview_type_archival before update on public.question_interview_types for each row execute function private.prevent_active_taxonomy_archival();
create trigger trg_prevent_skill_archival before update on public.question_skills for each row execute function private.prevent_active_taxonomy_archival();
create trigger trg_prevent_topic_archival before update on public.question_topics for each row execute function private.prevent_active_taxonomy_archival();


-- 11. Security Helpers
create or replace function private.is_active_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'active'
      and deleted_at is null
  );
end;
$$;

revoke execute on function private.is_active_admin() from public, anon;
grant execute on function private.is_active_admin() to authenticated;
grant execute on function private.is_active_admin() to service_role;

-- 12. Row Level Security
alter table public.question_categories enable row level security;
alter table public.question_difficulties enable row level security;
alter table public.question_interview_types enable row level security;
alter table public.question_skills enable row level security;
alter table public.question_topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_internal_data enable row level security;
alter table public.question_skill_mappings enable row level security;
alter table public.question_topic_mappings enable row level security;

-- Taxonomies Student Read
create policy taxonomies_categories_student_read on public.question_categories for select to authenticated using (is_active = true and private.is_active_user());
create policy taxonomies_difficulties_student_read on public.question_difficulties for select to authenticated using (is_active = true and private.is_active_user());
create policy taxonomies_interview_types_student_read on public.question_interview_types for select to authenticated using (is_active = true and private.is_active_user());
create policy taxonomies_skills_student_read on public.question_skills for select to authenticated using (is_active = true and private.is_active_user());
create policy taxonomies_topics_student_read on public.question_topics for select to authenticated using (is_active = true and private.is_active_user());

-- Taxonomies Admin All
create policy taxonomies_categories_admin_all on public.question_categories for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());
create policy taxonomies_difficulties_admin_all on public.question_difficulties for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());
create policy taxonomies_interview_types_admin_all on public.question_interview_types for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());
create policy taxonomies_skills_admin_all on public.question_skills for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());
create policy taxonomies_topics_admin_all on public.question_topics for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());

-- Questions Student Read
create policy questions_student_read on public.questions for select to authenticated using (status = 'published' and private.is_active_user());

-- Questions Admin All
create policy questions_admin_all on public.questions for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());

-- Internal Data Admin All
create policy question_internal_data_admin_all on public.question_internal_data for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());

-- Mappings Student Read
create policy question_skill_mappings_student_read on public.question_skill_mappings for select to authenticated using (
  private.is_active_user() and exists (select 1 from public.questions q where q.id = question_id and q.status = 'published')
);
create policy question_topic_mappings_student_read on public.question_topic_mappings for select to authenticated using (
  private.is_active_user() and exists (select 1 from public.questions q where q.id = question_id and q.status = 'published')
);

-- Mappings Admin All
create policy question_skill_mappings_admin_all on public.question_skill_mappings for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());
create policy question_topic_mappings_admin_all on public.question_topic_mappings for all to authenticated using (private.is_active_admin()) with check (private.is_active_admin());

-- 12. Grants and Revokes
revoke all on public.question_categories from public, anon, authenticated;
revoke all on public.question_difficulties from public, anon, authenticated;
revoke all on public.question_interview_types from public, anon, authenticated;
revoke all on public.question_skills from public, anon, authenticated;
revoke all on public.question_topics from public, anon, authenticated;
revoke all on public.questions from public, anon, authenticated;
revoke all on public.question_internal_data from public, anon, authenticated;
revoke all on public.question_skill_mappings from public, anon, authenticated;
revoke all on public.question_topic_mappings from public, anon, authenticated;

grant select, insert, update on public.question_categories to authenticated;
grant select, insert, update on public.question_difficulties to authenticated;
grant select, insert, update on public.question_interview_types to authenticated;
grant select, insert, update on public.question_skills to authenticated;
grant select, insert, update on public.question_topics to authenticated;
grant select, insert, update on public.questions to authenticated;
grant select, insert, update on public.question_internal_data to authenticated;
grant select, insert, delete on public.question_skill_mappings to authenticated;
grant select, insert, delete on public.question_topic_mappings to authenticated;

grant all on public.question_categories to service_role;
grant all on public.question_difficulties to service_role;
grant all on public.question_interview_types to service_role;
grant all on public.question_skills to service_role;
grant all on public.question_topics to service_role;
grant all on public.questions to service_role;
grant all on public.question_internal_data to service_role;
grant all on public.question_skill_mappings to service_role;
grant all on public.question_topic_mappings to service_role;
