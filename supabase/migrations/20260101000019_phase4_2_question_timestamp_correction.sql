-- Migration 19: Question Bank Timestamp Trigger Correction
-- Restores secure updated_at behavior for questions and internal data

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at 
  before update on public.questions 
  for each row 
  when (
    old.question_text is distinct from new.question_text or
    old.category_id is distinct from new.category_id or
    old.difficulty_id is distinct from new.difficulty_id or
    old.interview_type_id is distinct from new.interview_type_id or
    old.status is distinct from new.status
  )
  execute function private.set_updated_at();

drop trigger if exists set_question_internal_data_updated_at on public.question_internal_data;
create trigger set_question_internal_data_updated_at 
  before update on public.question_internal_data 
  for each row 
  when (
    old.reference_answer is distinct from new.reference_answer or
    old.evaluation_guidance is distinct from new.evaluation_guidance
  )
  execute function private.set_updated_at();
