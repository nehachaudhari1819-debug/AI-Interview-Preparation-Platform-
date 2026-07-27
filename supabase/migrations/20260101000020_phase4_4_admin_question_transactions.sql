-- Migration 20: Phase 4.4 Admin Question Transactions
-- Introduces SECURITY INVOKER RPCs for atomic question creation and update.
-- These functions rely on the existing RLS policies of the caller's session.

create or replace function public.admin_create_question(
  p_question_text text,
  p_category_id uuid,
  p_difficulty_id uuid,
  p_interview_type_id uuid,
  p_reference_answer text default null,
  p_evaluation_guidance jsonb default null,
  p_skill_ids uuid[] default null,
  p_topic_ids uuid[] default null
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_skill_id uuid;
  v_topic_id uuid;
  v_created_by uuid;
begin
  if not private.is_active_admin() then
    raise exception 'Unauthorized';
  end if;

  v_created_by := auth.uid();

  if p_evaluation_guidance is not null and jsonb_typeof(p_evaluation_guidance) <> 'object' then
    raise exception 'evaluation_guidance must be a JSON object' using errcode = '22023';
  end if;

  -- 1. Insert question (fails if category, difficulty, or interview_type are inactive or missing due to FK/triggers)
  insert into public.questions (
    question_text,
    category_id,
    difficulty_id,
    interview_type_id,
    status,
    created_by
  ) values (
    p_question_text,
    p_category_id,
    p_difficulty_id,
    p_interview_type_id,
    'draft',
    v_created_by
  ) returning id into v_question_id;

  -- 2. Insert internal data
  insert into public.question_internal_data (
    question_id,
    reference_answer,
    evaluation_guidance
  ) values (
    v_question_id,
    p_reference_answer,
    p_evaluation_guidance
  );

  -- 3. Insert skill mappings
  if p_skill_ids is not null then
    foreach v_skill_id in array p_skill_ids loop
      insert into public.question_skill_mappings (question_id, skill_id)
      values (v_question_id, v_skill_id);
    end loop;
  end if;

  -- 4. Insert topic mappings
  if p_topic_ids is not null then
    foreach v_topic_id in array p_topic_ids loop
      insert into public.question_topic_mappings (question_id, topic_id)
      values (v_question_id, v_topic_id);
    end loop;
  end if;

  return v_question_id;
end;
$$;

revoke all on function public.admin_create_question(text, uuid, uuid, uuid, text, jsonb, uuid[], uuid[]) from public;
revoke all on function public.admin_create_question(text, uuid, uuid, uuid, text, jsonb, uuid[], uuid[]) from anon;
grant execute on function public.admin_create_question(text, uuid, uuid, uuid, text, jsonb, uuid[], uuid[]) to authenticated;

create or replace function public.admin_update_question(
  p_question_id uuid,
  p_payload jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_skill_ids jsonb;
  v_topic_ids jsonb;
begin
  if not private.is_active_admin() then
    raise exception 'Unauthorized';
  end if;

  if p_payload ? 'status' or p_payload ? 'created_by' or p_payload ? 'published_by' or p_payload ? 'published_at' or p_payload ? 'archived_by' or p_payload ? 'archived_at' or p_payload ? 'created_at' or p_payload ? 'updated_at' then
    raise exception 'Cannot update lifecycle fields via this RPC';
  end if;

  if p_payload ? 'evaluation_guidance' and (p_payload -> 'evaluation_guidance' is not null and jsonb_typeof(p_payload -> 'evaluation_guidance') <> 'object') then
    raise exception 'evaluation_guidance must be a JSON object' using errcode = '22023';
  end if;

  -- 1. Update questions table if any base fields are present
  if p_payload ? 'question_text' or p_payload ? 'category_id' or p_payload ? 'difficulty_id' or p_payload ? 'interview_type_id' then
    update public.questions
    set
      question_text = coalesce((p_payload->>'question_text')::text, question_text),
      category_id = coalesce((p_payload->>'category_id')::uuid, category_id),
      difficulty_id = coalesce((p_payload->>'difficulty_id')::uuid, difficulty_id),
      interview_type_id = coalesce((p_payload->>'interview_type_id')::uuid, interview_type_id)
    where id = p_question_id;
  end if;

  -- 2. Update internal data if fields are present
  if p_payload ? 'reference_answer' or p_payload ? 'evaluation_guidance' then
    update public.question_internal_data
    set
      reference_answer = case when p_payload ? 'reference_answer' then (p_payload->>'reference_answer')::text else reference_answer end,
      evaluation_guidance = case when p_payload ? 'evaluation_guidance' then p_payload->'evaluation_guidance' else evaluation_guidance end
    where question_id = p_question_id;
  end if;

  -- 3. Replace skill mappings if provided
  if p_payload ? 'skill_ids' then
    delete from public.question_skill_mappings where question_id = p_question_id;
    v_skill_ids := p_payload->'skill_ids';
    if v_skill_ids is not null and jsonb_array_length(v_skill_ids) > 0 then
      for i in 0 .. jsonb_array_length(v_skill_ids) - 1 loop
        insert into public.question_skill_mappings (question_id, skill_id)
        values (p_question_id, (v_skill_ids->>i)::uuid);
      end loop;
    end if;
  end if;

  -- 4. Replace topic mappings if provided
  if p_payload ? 'topic_ids' then
    delete from public.question_topic_mappings where question_id = p_question_id;
    v_topic_ids := p_payload->'topic_ids';
    if v_topic_ids is not null and jsonb_array_length(v_topic_ids) > 0 then
      for i in 0 .. jsonb_array_length(v_topic_ids) - 1 loop
        insert into public.question_topic_mappings (question_id, topic_id)
        values (p_question_id, (v_topic_ids->>i)::uuid);
      end loop;
    end if;
  end if;
end;
$$;

revoke all on function public.admin_update_question(uuid, jsonb) from public;
revoke all on function public.admin_update_question(uuid, jsonb) from anon;
grant execute on function public.admin_update_question(uuid, jsonb) to authenticated;
