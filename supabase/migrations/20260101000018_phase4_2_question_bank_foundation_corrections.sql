-- Migration 18: Question Bank Foundation Corrections
-- Addresses security and consistency gaps identified in P4.2 review

-- 1. Enforce admin-only access to base questions table and create student-safe view
drop policy questions_student_read on public.questions;

create view public.published_questions as
select 
  id, 
  question_text, 
  category_id, 
  difficulty_id, 
  interview_type_id, 
  created_at, 
  updated_at
from public.questions
where status = 'published' and private.is_active_user();

revoke all on public.published_questions from anon, authenticated, public;
grant select on public.published_questions to authenticated;

-- Update mappings RLS to read from the secure view instead of the base table
drop policy question_skill_mappings_student_read on public.question_skill_mappings;
create policy question_skill_mappings_student_read on public.question_skill_mappings for select to authenticated using (
  private.is_active_user() and exists (select 1 from public.published_questions q where q.id = question_id)
);

drop policy question_topic_mappings_student_read on public.question_topic_mappings;
create policy question_topic_mappings_student_read on public.question_topic_mappings for select to authenticated using (
  private.is_active_user() and exists (select 1 from public.published_questions q where q.id = question_id)
);


-- 2. Convert evaluation_guidance to JSONB and enforce object shape
DO $$ 
DECLARE 
  _constraint_name text;
BEGIN
  SELECT conname INTO _constraint_name
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
  WHERE c.conrelid = 'public.question_internal_data'::regclass
    AND a.attname = 'evaluation_guidance'
    AND c.contype = 'c';

  IF _constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.question_internal_data DROP CONSTRAINT ' || _constraint_name;
  END IF;
END $$;

alter table public.question_internal_data
  alter column evaluation_guidance type jsonb using evaluation_guidance::jsonb;

alter table public.question_internal_data
  add constraint check_evaluation_guidance_is_object check (evaluation_guidance is null or jsonb_typeof(evaluation_guidance) = 'object');


-- 3. Fix no-op updates triggering updated_at on questions
drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at 
  before update on public.questions 
  for each row 
  when (
    old.question_text is distinct from new.question_text or
    old.category_id is distinct from new.category_id or
    old.difficulty_id is distinct from new.difficulty_id or
    old.interview_type_id is distinct from new.interview_type_id or
    old.status is distinct from new.status or
    old.created_by is distinct from new.created_by or
    old.published_at is distinct from new.published_at or
    old.archived_at is distinct from new.archived_at
  )
  execute function private.set_updated_at();


-- 4. Enforce canonical taxonomy values (lowercase slugs, approved pattern, no blanks)
alter table public.question_categories
  add constraint question_categories_slug_format check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint question_categories_name_not_blank check (btrim(name) <> '');

alter table public.question_difficulties
  add constraint question_difficulties_slug_format check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint question_difficulties_name_not_blank check (btrim(name) <> '');

alter table public.question_interview_types
  add constraint question_interview_types_slug_format check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint question_interview_types_name_not_blank check (btrim(name) <> '');

alter table public.question_skills
  add constraint question_skills_slug_format check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint question_skills_name_not_blank check (btrim(name) <> '');

alter table public.question_topics
  add constraint question_topics_slug_format check (slug = lower(btrim(slug)) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  add constraint question_topics_name_not_blank check (btrim(name) <> '');


-- 5. Fix Draft Questions being assigned inactive taxonomies on update
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
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.category_id is distinct from old.category_id) then
    select is_active into _cat_active from public.question_categories where id = new.category_id;
    if not _cat_active then raise exception 'Category must be active'; end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.difficulty_id is distinct from old.difficulty_id) then
    select is_active into _diff_active from public.question_difficulties where id = new.difficulty_id;
    if not _diff_active then raise exception 'Difficulty must be active'; end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.interview_type_id is distinct from old.interview_type_id) then
    select is_active into _type_active from public.question_interview_types where id = new.interview_type_id;
    if not _type_active then raise exception 'Interview type must be active'; end if;
  end if;

  if new.status = 'published' then
    if _cat_active is null then
      select is_active into _cat_active from public.question_categories where id = new.category_id;
    end if;
    if not _cat_active then raise exception 'Cannot publish with inactive category'; end if;

    if _diff_active is null then
      select is_active into _diff_active from public.question_difficulties where id = new.difficulty_id;
    end if;
    if not _diff_active then raise exception 'Cannot publish with inactive difficulty'; end if;

    if _type_active is null then
      select is_active into _type_active from public.question_interview_types where id = new.interview_type_id;
    end if;
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
