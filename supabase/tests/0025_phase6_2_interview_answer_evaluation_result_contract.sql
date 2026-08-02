begin;
select plan(55);

-- 1. Structural Checks: Tables & RLS (Direct checks)
SELECT is((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_session_answers'), true, 'interview_session_answers has RLS enabled');
SELECT is((SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_session_answers'), true, 'interview_session_answers has FORCE RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_answer_evaluations'), true, 'interview_answer_evaluations has RLS enabled');
SELECT is((SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_answer_evaluations'), true, 'interview_answer_evaluations has FORCE RLS enabled');
SELECT is((SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_session_results'), true, 'interview_session_results has RLS enabled');
SELECT is((SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'interview_session_results'), true, 'interview_session_results has FORCE RLS enabled');

-- Schema contract — assertions 1–3
-- 1. Complete column contract
SELECT set_eq(
  $$
    SELECT
      columns.table_name::text COLLATE "C",
      columns.column_name::text COLLATE "C",
      columns.data_type::text COLLATE "C",
      columns.is_nullable::text COLLATE "C"
    FROM information_schema.columns AS columns
    WHERE columns.table_schema = 'public'
      AND columns.table_name IN (
        'interview_session_answers',
        'interview_answer_evaluations',
        'interview_session_results'
      )
  $$,
  $$
    VALUES
      ('interview_answer_evaluations'::text COLLATE "C", 'id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'user_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'interview_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'session_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'session_question_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'answer_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'status'::text COLLATE "C", 'text'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'evaluation_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'rubric_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'prompt_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'scoring_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'provider'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'model'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'attempt_count'::text COLLATE "C", 'integer'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'lease_token'::text COLLATE "C", 'uuid'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'lease_expires_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'started_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'completed_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'failed_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'failure_code'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'overall_score'::text COLLATE "C", 'integer'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'dimension_scores'::text COLLATE "C", 'jsonb'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'strengths'::text COLLATE "C", 'ARRAY'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'improvement_areas'::text COLLATE "C", 'ARRAY'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'student_feedback'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'evaluator_metadata'::text COLLATE "C", 'jsonb'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'created_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'updated_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C"),

      ('interview_session_answers'::text COLLATE "C", 'id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'user_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'interview_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'session_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'session_question_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'response_type'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'text_response'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'code_response'::text COLLATE "C", 'jsonb'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'status'::text COLLATE "C", 'text'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'version'::text COLLATE "C", 'integer'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'finalized_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'skipped_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'created_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_answers'::text COLLATE "C", 'updated_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C"),

      ('interview_session_results'::text COLLATE "C", 'id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'user_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'interview_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'session_id'::text COLLATE "C", 'uuid'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'status'::text COLLATE "C", 'text'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'overall_score'::text COLLATE "C", 'integer'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'score_breakdown'::text COLLATE "C", 'jsonb'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'strengths'::text COLLATE "C", 'ARRAY'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'improvement_summary'::text COLLATE "C", 'text'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'scoring_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'publication_version'::text COLLATE "C", 'integer'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'generated_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'YES'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'created_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'updated_at'::text COLLATE "C", 'timestamp with time zone'::text COLLATE "C", 'NO'::text COLLATE "C")
  $$,
  'Complete column contract matches schema'
);

-- 2. Complete constraint contract
SELECT set_eq(
  $$
    SELECT
      constraint_table.relname::text COLLATE "C",
      constraint_definition.conname::text COLLATE "C",
      constraint_definition.contype::text COLLATE "C",
      pg_catalog.pg_get_constraintdef(
        constraint_definition.oid
      )::text COLLATE "C"
    FROM pg_catalog.pg_constraint AS constraint_definition
    JOIN pg_catalog.pg_class AS constraint_table
      ON constraint_table.oid = constraint_definition.conrelid
    JOIN pg_catalog.pg_namespace AS constraint_schema
      ON constraint_schema.oid = constraint_table.relnamespace
    WHERE constraint_schema.nspname = 'public'
      AND constraint_table.relname IN (
        'interview_session_answers',
        'interview_answer_evaluations',
        'interview_session_results'
      )
  $$,
  $$
    VALUES
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_array_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_array_bounds' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_attempt_range'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_attempt_range' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_failure_code_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_failure_code_bounds' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_feedback_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_feedback_bounds' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_model_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_model_bounds' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_provider_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_provider_bounds' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_score_range'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_score_range' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_state_predicate'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_state_predicate' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_status'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_status' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'chk_eval_version_fields'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_eval_version_fields' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'evaluations_user_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'evaluations_user_fkey' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'interview_answer_evaluations_answer_chain_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_answer_evaluations_answer_chain_fkey' AND conrelid = 'public.interview_answer_evaluations'::regclass)),
      ('interview_answer_evaluations'::text COLLATE "C", 'interview_answer_evaluations_pkey'::text COLLATE "C", 'p'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_answer_evaluations_pkey' AND conrelid = 'public.interview_answer_evaluations'::regclass)),

      ('interview_session_answers'::text COLLATE "C", 'answers_question_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'answers_question_fkey' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'answers_session_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'answers_session_fkey' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'answers_user_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'answers_user_fkey' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_code_contract'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_code_contract' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_response_type'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_response_type' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_state_predicate'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_state_predicate' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_status'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_status' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_text_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_text_bounds' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'chk_answer_version'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_answer_version' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_ownership_key'::text COLLATE "C", 'u'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_session_answers_ownership_key' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_pkey'::text COLLATE "C", 'p'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_session_answers_pkey' AND conrelid = 'public.interview_session_answers'::regclass)),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_session_question_key'::text COLLATE "C", 'u'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_session_answers_session_question_key' AND conrelid = 'public.interview_session_answers'::regclass)),

      ('interview_session_results'::text COLLATE "C", 'chk_result_score_range'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_score_range' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'chk_result_state_predicate'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_state_predicate' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'chk_result_status'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_status' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'chk_result_strengths_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_strengths_bounds' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'chk_result_summary_bounds'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_summary_bounds' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'chk_result_version_fields'::text COLLATE "C", 'c'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'chk_result_version_fields' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'interview_session_results_pkey'::text COLLATE "C", 'p'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'interview_session_results_pkey' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'results_session_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'results_session_fkey' AND conrelid = 'public.interview_session_results'::regclass)),
      ('interview_session_results'::text COLLATE "C", 'results_user_fkey'::text COLLATE "C", 'f'::text COLLATE "C", (SELECT pg_catalog.pg_get_constraintdef(oid)::text COLLATE "C" FROM pg_catalog.pg_constraint WHERE conname = 'results_user_fkey' AND conrelid = 'public.interview_session_results'::regclass))
  $$,
  'Complete constraint contract'
);

-- 3. Complete index contract
SELECT set_eq(
  $$
    SELECT
      indexes.tablename::text COLLATE "C",
      indexes.indexname::text COLLATE "C",
      indexes.indexdef::text COLLATE "C"
    FROM pg_catalog.pg_indexes AS indexes
    WHERE indexes.schemaname = 'public'
      AND indexes.tablename IN (
        'interview_session_answers',
        'interview_answer_evaluations',
        'interview_session_results'
      )
  $$,
  $$
    VALUES
      ('interview_answer_evaluations'::text COLLATE "C", 'idx_evaluations_worker_claim'::text COLLATE "C", 'CREATE INDEX idx_evaluations_worker_claim ON public.interview_answer_evaluations USING btree (created_at, id) WHERE ((status = ''pending''::text) AND (attempt_count < 3))'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'idx_evaluations_expired_lease'::text COLLATE "C", 'CREATE INDEX idx_evaluations_expired_lease ON public.interview_answer_evaluations USING btree (lease_expires_at, created_at, id) WHERE ((status = ''processing''::text) AND (attempt_count < 3))'::text COLLATE "C"),
      ('interview_answer_evaluations'::text COLLATE "C", 'idx_evaluations_exhausted_lease'::text COLLATE "C", 'CREATE INDEX idx_evaluations_exhausted_lease ON public.interview_answer_evaluations USING btree (lease_expires_at, created_at, id) WHERE ((status = ''processing''::text) AND (attempt_count = 3))'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'idx_results_session_version'::text COLLATE "C", 'CREATE UNIQUE INDEX idx_results_session_version ON public.interview_session_results USING btree (session_id, publication_version)'::text COLLATE "C"),
      ('interview_session_results'::text COLLATE "C", 'idx_interview_session_results_latest'::text COLLATE "C", 'CREATE INDEX idx_interview_session_results_latest ON public.interview_session_results USING btree (session_id, publication_version DESC)'::text COLLATE "C"),

      ('interview_answer_evaluations'::text COLLATE "C", 'idx_evaluations_answer_version'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'idx_evaluations_answer_version')),
      ('interview_answer_evaluations'::text COLLATE "C", 'idx_evaluations_session'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'idx_evaluations_session')),
      ('interview_answer_evaluations'::text COLLATE "C", 'interview_answer_evaluations_pkey'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'interview_answer_evaluations_pkey')),

      ('interview_session_answers'::text COLLATE "C", 'idx_interview_session_answers_status'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'idx_interview_session_answers_status')),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_ownership_key'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'interview_session_answers_ownership_key')),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_pkey'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'interview_session_answers_pkey')),
      ('interview_session_answers'::text COLLATE "C", 'interview_session_answers_session_question_key'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'interview_session_answers_session_question_key')),

      ('interview_session_results'::text COLLATE "C", 'idx_results_user_session'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'idx_results_user_session')),
      ('interview_session_results'::text COLLATE "C", 'interview_session_results_pkey'::text COLLATE "C", (SELECT pg_catalog.pg_get_indexdef(indexrelid)::text COLLATE "C" FROM pg_catalog.pg_index JOIN pg_catalog.pg_class ON pg_class.oid = indexrelid WHERE relname = 'interview_session_results_pkey'))
  $$,
  'Complete index contract'
);

-- Privilege Logic (3 assertions)
SELECT results_eq(
  $$
    SELECT CASE WHEN count(*) > 0 THEN false ELSE true END
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a ON true
    LEFT JOIN pg_catalog.pg_roles r ON a.grantee = r.oid
    WHERE n.nspname = 'public'
      AND c.relname IN ('interview_session_answers', 'interview_answer_evaluations', 'interview_session_results')
      AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated', 'service_role'))
      AND a.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT', 'TRUNCATE')
  $$,
  $$ VALUES (true) $$,
  'All three Phase 6 tables expose no direct privileges to anon/authenticated/service_role'
);

SELECT results_eq(
  $$
    SELECT CASE WHEN count(*) > 0 THEN false ELSE true END
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_catalog.aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a ON true
    LEFT JOIN pg_catalog.pg_roles r ON a.grantee = r.oid
    WHERE p.proname IN (
        'student_list_session_answers', 'student_get_session_answer', 'student_get_answer_evaluation', 'student_get_latest_session_result',
        'enforce_interview_session_answer_contract', 'enforce_interview_answer_evaluation_contract', 'enforce_interview_session_result_contract'
      )
      AND (
        (p.proname LIKE 'student_%' AND (a.grantee = 0 OR r.rolname IN ('anon', 'service_role'))) OR
        (p.proname LIKE 'enforce_%' AND (a.grantee = 0 OR r.rolname IN ('anon', 'authenticated', 'service_role')))
      )
  $$,
  $$ VALUES (true) $$,
  'Read RPCs grant EXECUTE only to authenticated; triggers expose no operational rights'
);

SELECT results_eq(
  $$
    SELECT CASE WHEN count(*) > 0 THEN false ELSE true END
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_roles r ON p.proowner = r.oid
    WHERE p.proname IN (
        'student_list_session_answers', 'student_get_session_answer', 'student_get_answer_evaluation', 'student_get_latest_session_result',
        'enforce_interview_session_answer_contract', 'enforce_interview_answer_evaluation_contract', 'enforce_interview_session_result_contract'
      )
      AND (
        r.rolname != 'postgres' OR
        p.prosecdef != true OR
        NOT ('search_path=""' = ANY(COALESCE(p.proconfig, ARRAY[]::text[])))
      )
  $$,
  $$ VALUES (true) $$,
  'All security-sensitive functions have correct owner, SECURITY DEFINER mode, and empty search_path'
);


-- Setup Base Data
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'test_user@example.com');
INSERT INTO public.question_interview_types (id, name, slug) VALUES ('00000000-0000-0000-0001-000000000001'::uuid, 'Phase 6.2 Interview Type', 'phase-6-2-interview-type');
INSERT INTO public.question_difficulties (id, name, slug) VALUES ('00000000-0000-0000-0002-000000000001'::uuid, 'Phase 6.2 Difficulty', 'phase-6-2-difficulty');

INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Phase 6.2 Contract Interview', 'Backend Engineer', '00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 3);

INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot, config_snapshot_version, started_at)
VALUES ('33333333-3333-3333-3333-333333333333'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'in_progress', jsonb_build_object('title', 'Phase 6.2 Contract Interview', 'targetRole', 'Backend Engineer', 'questionCount', 3), 1, clock_timestamp());

-- Completed session for the terminal test
INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot, config_snapshot_version, started_at, completed_at)
VALUES ('33333333-3333-3333-3333-333333333334'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'completed', jsonb_build_object('title', 'Phase 6.2 Contract Interview', 'targetRole', 'Backend Engineer', 'questionCount', 3), 1, clock_timestamp(), clock_timestamp());

-- Questions...
INSERT INTO public.question_categories (id, name, slug) VALUES ('00000000-0000-0000-0005-000000000001'::uuid, 'Phase 6.2 Category', 'phase-6-2-category');
INSERT INTO public.questions (id, created_by, category_id, interview_type_id, difficulty_id, question_text, status)
VALUES
('00000000-0000-0000-0006-000000000001'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0005-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 'Explain how dependency injection improves modularity and testability.', 'draft'),
('00000000-0000-0000-0006-000000000002'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0005-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 'Describe how database transactions preserve consistency during concurrent operations.', 'draft'),
('00000000-0000-0000-0006-000000000003'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, '00000000-0000-0000-0005-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, '00000000-0000-0000-0002-000000000001'::uuid, 'Explain how idempotency prevents duplicate processing in distributed APIs.', 'draft');

INSERT INTO public.interview_session_questions (id, session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot, question_snapshot_version)
VALUES
('44444444-4444-4444-4444-444444444444'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0006-000000000001'::uuid, 3, 'Phase 6.2 test question 1', jsonb_build_object('interviewType', 'Phase 6.2 Interview Type', 'difficulty', 'Phase 6.2 Difficulty'), 1),
('66666666-6666-6666-6666-666666666666'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0006-000000000002'::uuid, 1, 'Phase 6.2 test question 2', jsonb_build_object('interviewType', 'Phase 6.2 Interview Type', 'difficulty', 'Phase 6.2 Difficulty'), 1),
('88888888-8888-8888-8888-888888888888'::uuid, '33333333-3333-3333-3333-333333333333'::uuid, '00000000-0000-0000-0006-000000000003'::uuid, 2, 'Phase 6.2 test question 3', jsonb_build_object('interviewType', 'Phase 6.2 Interview Type', 'difficulty', 'Phase 6.2 Difficulty'), 1);

-- Terminal session questions
INSERT INTO public.interview_session_questions (id, session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot, question_snapshot_version)
VALUES ('44444444-4444-4444-4444-444444444445'::uuid, '33333333-3333-3333-3333-333333333334'::uuid, '00000000-0000-0000-0006-000000000001'::uuid, 1, 'Phase 6.2 terminal test question', jsonb_build_object('interviewType', 'Phase 6.2 Interview Type', 'difficulty', 'Phase 6.2 Difficulty'), 1);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
reset role;

-- 3. Answers Tests
select throws_ok(
  'insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, text_response, status)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''44444444-4444-4444-4444-444444444444'', ''text'', ''My answer'', ''finalized'')',
  'P0003',
  'RESOURCE_CONFLICT',
  'Direct insertion of a finalized answer is rejected'
);

insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, text_response, status)
values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'text', 'My initial answer', 'draft');

SELECT results_eq(
  $$ SELECT status, version FROM public.interview_session_answers WHERE id = '55555555-5555-5555-5555-555555555555'::uuid $$,
  $$ VALUES ('draft'::text, 1::integer) $$,
  'Draft answer inserted correctly with version 1'
);

select throws_ok(
  'update public.interview_session_answers set text_response = ''My updated answer'' where id = ''55555555-5555-5555-5555-555555555555''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Updating draft without incrementing version fails'
);

update public.interview_session_answers set text_response = 'My updated answer', version = 2 where id = '55555555-5555-5555-5555-555555555555';

SELECT results_eq(
  'select version from public.interview_session_answers where id = ''55555555-5555-5555-5555-555555555555''',
  ARRAY[2::integer],
  'Draft update succeeds with version increment'
);

select throws_ok(
  'update public.interview_session_answers set status = ''skipped'', skipped_at = now() where id = ''55555555-5555-5555-5555-555555555555''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Transition from draft to skipped is rejected'
);

select throws_ok(
  'update public.interview_session_answers set response_type = ''code'', version = 3 where id = ''55555555-5555-5555-5555-555555555555''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Attempt to update protected field response_type is rejected'
);

update public.interview_session_answers set status = 'finalized', version = 3, finalized_at = now() where id = '55555555-5555-5555-5555-555555555555';

select throws_ok(
  'update public.interview_session_answers set text_response = ''hacked'', version = 4 where id = ''55555555-5555-5555-5555-555555555555''',
  'P0013',
  'ANSWER_IMMUTABLE',
  'Finalized answers cannot be updated'
);

insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, text_response, code_response, status, skipped_at)
values ('77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', null, null, null, 'skipped', now());

select throws_ok(
  'update public.interview_session_answers set status = ''draft'', version = 2 where id = ''77777777-7777-7777-7777-777777777777''',
  'P0014',
  'ANSWER_SKIPPED',
  'Skipped answers cannot be updated'
);

select throws_ok(
  'insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, text_response, status)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333334'', ''44444444-4444-4444-4444-444444444445'', ''text'', ''Late answer'', ''draft'')',
  'P0011',
  'SESSION_TERMINAL',
  'Draft write against a terminal session is rejected'
);

insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, code_response, status)
values ('77777777-7777-7777-7777-777777777778', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', 'code', '{"source": "console.log();", "language": "typescript", "explanation": "test"}', 'draft');

SELECT results_eq(
  $$ SELECT status FROM public.interview_session_answers WHERE id = '77777777-7777-7777-7777-777777777778'::uuid $$,
  $$ VALUES ('draft'::text) $$,
  'Valid code answer is accepted with source, language, explanation'
);

select throws_ok(
  'insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, text_response, status)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''66666666-6666-6666-6666-666666666666'', ''text'', repeat(''a'', 10001), ''draft'')',
  '23514',
  'new row for relation "interview_session_answers" violates check constraint "chk_answer_text_bounds"',
  'Oversized text answer exceeding 10,000 chars is rejected'
);

select throws_ok(
  'insert into public.interview_session_answers (id, user_id, interview_id, session_id, session_question_id, response_type, code_response, status)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''88888888-8888-8888-8888-888888888888'', ''code'', ''{"source":"abc"}''::jsonb, ''draft'')',
  '23514',
  'new row for relation "interview_session_answers" violates check constraint "chk_answer_code_contract"',
  'Code answer must conform to strictly bounded JSON contract'
);


-- 4. Evaluations Tests
insert into public.interview_answer_evaluations (id, user_id, interview_id, session_id, session_question_id, answer_id, status, rubric_version, prompt_version, scoring_version, evaluation_version)
values ('99999999-9999-9999-9999-999999999999', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', 'pending', 1, 1, 1, 1);

select throws_ok(
  'insert into public.interview_answer_evaluations (id, user_id, interview_id, session_id, session_question_id, answer_id, status, rubric_version, prompt_version, scoring_version)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''66666666-6666-6666-6666-666666666666'', ''77777777-7777-7777-7777-777777777777'', ''pending'', 1, 1, 1)',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Cannot insert pending evaluation for skipped answer'
);

insert into public.interview_answer_evaluations (id, user_id, interview_id, session_id, session_question_id, answer_id, status, evaluation_version)
values ('99999999-9999-9999-9999-999999999998', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777', 'skipped', 1);

SELECT results_eq(
  $$ SELECT status FROM public.interview_answer_evaluations WHERE id = '99999999-9999-9999-9999-999999999998'::uuid $$,
  $$ VALUES ('skipped'::text) $$,
  'Valid skipped evaluation accepted'
);

select throws_ok(
  'insert into public.interview_answer_evaluations (id, user_id, interview_id, session_id, session_question_id, answer_id, status, rubric_version, prompt_version, scoring_version)
   values (gen_random_uuid(), ''11111111-1111-1111-1111-111111111111'', ''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''88888888-8888-8888-8888-888888888888'', ''77777777-7777-7777-7777-777777777778'', ''pending'', 1, 1, 1)',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Non-skipped evaluation for draft answer rejected'
);

select throws_ok(
  'update public.interview_answer_evaluations set status = ''processing'', attempt_count = 1 where id = ''99999999-9999-9999-9999-999999999999''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Lease acquisition fails without exact started_at, lease_token, and 5-min lease_expires_at'
);

WITH lease_time AS (SELECT pg_catalog.clock_timestamp() AS acquired_at)
UPDATE public.interview_answer_evaluations AS evaluation
SET status = 'processing', attempt_count = 1, started_at = lease_time.acquired_at, lease_token = '88888888-8888-8888-8888-888888888881'::uuid, lease_expires_at = lease_time.acquired_at + interval '5 minutes'
FROM lease_time WHERE evaluation.id = '99999999-9999-9999-9999-999999999999'::uuid;

SELECT results_eq(
  $$ SELECT status, attempt_count FROM public.interview_answer_evaluations WHERE id = '99999999-9999-9999-9999-999999999999'::uuid $$,
  $$ VALUES ('processing'::text, 1::integer) $$,
  'Lease acquisition succeeds with valid lease boundaries'
);

select throws_ok(
  'update public.interview_answer_evaluations set status = ''processing'', attempt_count = 2, lease_token = gen_random_uuid(), started_at = now(), lease_expires_at = now() + interval ''5 minutes'' where id = ''99999999-9999-9999-9999-999999999999''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Active lease reclamation fails when lease is not yet expired'
);

ALTER TABLE public.interview_answer_evaluations DISABLE TRIGGER trg_interview_answer_evaluation_contract;
WITH expired_time AS (SELECT pg_catalog.clock_timestamp() - interval '10 minutes' AS started_at)
UPDATE public.interview_answer_evaluations AS evaluation SET started_at = expired_time.started_at, lease_expires_at = expired_time.started_at + interval '5 minutes' FROM expired_time WHERE evaluation.id = '99999999-9999-9999-9999-999999999999'::uuid;
ALTER TABLE public.interview_answer_evaluations ENABLE TRIGGER trg_interview_answer_evaluation_contract;

WITH reclaim_time AS (SELECT pg_catalog.clock_timestamp() AS acquired_at)
UPDATE public.interview_answer_evaluations AS evaluation SET status = 'processing', attempt_count = 2, started_at = reclaim_time.acquired_at, lease_token = '88888888-8888-8888-8888-888888888882'::uuid, lease_expires_at = reclaim_time.acquired_at + interval '5 minutes' FROM reclaim_time WHERE evaluation.id = '99999999-9999-9999-9999-999999999999'::uuid;

SELECT results_eq(
  $$ SELECT status, attempt_count FROM public.interview_answer_evaluations WHERE id = '99999999-9999-9999-9999-999999999999'::uuid $$,
  $$ VALUES ('processing'::text, 2::integer) $$,
  'Expired lease reclamation succeeds with new token and attempt_count 2'
);



select throws_ok(
  'update public.interview_answer_evaluations set status = ''completed'', completed_at = now(), provider = ''test'', model = ''test'', overall_score = 90 where id = ''99999999-9999-9999-9999-999999999999''',
  '23514',
  'new row for relation "interview_answer_evaluations" violates check constraint "chk_eval_state_predicate"',
  'Completion fails if dimension_scores, strengths, and improvement_areas are missing'
);

select throws_ok(
  'UPDATE public.interview_answer_evaluations SET status = ''completed'', provider = ''test'', model = ''test'', completed_at = clock_timestamp(), lease_token = NULL, lease_expires_at = NULL, overall_score = 90, dimension_scores = ''{"wrongKey": 90}''::jsonb, strengths = ARRAY[''good''], improvement_areas = ARRAY[''none''], student_feedback = ''Great job'' WHERE id = ''99999999-9999-9999-9999-999999999999''',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Completed evaluation with incorrect dimension keys rejected'
);

select throws_ok(
  'UPDATE public.interview_answer_evaluations SET status = ''completed'', provider = ''test'', model = ''test'', completed_at = clock_timestamp(), lease_token = NULL, lease_expires_at = NULL, overall_score = 90, dimension_scores = ''{"technicalAccuracy": 110, "relevance": 90, "completeness": 90, "clarity": 90, "technicalDepth": 90}''::jsonb, strengths = ARRAY[''good''], improvement_areas = ARRAY[''none''], student_feedback = ''Great job'' WHERE id = ''99999999-9999-9999-9999-999999999999''',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Dimension value out of bounds rejected'
);

select throws_ok(
  'UPDATE public.interview_answer_evaluations SET status = ''completed'', provider = ''test'', model = ''test'', completed_at = clock_timestamp(), lease_token = NULL, lease_expires_at = NULL, overall_score = 90, dimension_scores = ''{"technicalAccuracy": 90, "relevance": 90, "completeness": 90, "clarity": 90, "technicalDepth": 90}''::jsonb, strengths = ARRAY[''good''], improvement_areas = ARRAY[''none''], student_feedback = ''Great job'', evaluator_metadata = ''{"bad": "metadata"}''::jsonb WHERE id = ''99999999-9999-9999-9999-999999999999''',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Invalid evaluator_metadata is rejected'
);

UPDATE public.interview_answer_evaluations
SET status = 'completed', provider = 'test', model = 'test', completed_at = pg_catalog.clock_timestamp(), lease_token = NULL, lease_expires_at = NULL, overall_score = 90, dimension_scores = '{"technicalAccuracy": 90, "relevance": 90, "completeness": 90, "clarity": 90, "technicalDepth": 90}'::jsonb, strengths = ARRAY['good']::text[], improvement_areas = ARRAY['none']::text[], student_feedback = 'Great job'
WHERE id = '99999999-9999-9999-9999-999999999999'::uuid;

SELECT results_eq(
  'select status from public.interview_answer_evaluations where id = ''99999999-9999-9999-9999-999999999999''',
  ARRAY['completed'::text],
  'Valid processing to completed transition succeeds'
);

select throws_ok(
  'update public.interview_answer_evaluations set overall_score = 95 where id = ''99999999-9999-9999-9999-999999999999''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Completed evaluations are immutable'
);

INSERT INTO public.interview_answer_evaluations (
  id,
  user_id,
  interview_id,
  session_id,
  session_question_id,
  answer_id,
  status,
  rubric_version,
  prompt_version,
  scoring_version,
  evaluation_version
)
VALUES (
  '99999999-9999-9999-9999-999999999997'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  'pending',
  1,
  1,
  1,
  2
);

WITH lease_time AS (
  SELECT pg_catalog.clock_timestamp() AS acquired_at
)
UPDATE public.interview_answer_evaluations AS evaluation
SET
  status = 'processing',
  attempt_count = 1,
  started_at = lease_time.acquired_at,
  lease_token =
    'abababab-abab-abab-abab-abababababab'::uuid,
  lease_expires_at =
    lease_time.acquired_at + interval '5 minutes'
FROM lease_time
WHERE evaluation.id = '99999999-9999-9999-9999-999999999997'::uuid;

UPDATE public.interview_answer_evaluations
SET
  status = 'failed',
  failed_at = pg_catalog.clock_timestamp(),
  failure_code = 'PROVIDER_FAILURE',
  lease_token = NULL,
  lease_expires_at = NULL
WHERE id = '99999999-9999-9999-9999-999999999997'::uuid;

select throws_ok(
  'update public.interview_answer_evaluations set failure_code = ''ERROR'' where id = ''99999999-9999-9999-9999-999999999997''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Failed evaluations are immutable'
);

INSERT INTO public.interview_answer_evaluations (
  id,
  user_id,
  interview_id,
  session_id,
  session_question_id,
  answer_id,
  status,
  evaluation_version,
  rubric_version,
  prompt_version,
  scoring_version
)
VALUES (
  '99999999-9999-9999-9999-999999999991'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  'pending',
  3,
  1,
  1,
  1
);

WITH lease_time AS (
  SELECT pg_catalog.clock_timestamp() AS acquired_at
)
UPDATE public.interview_answer_evaluations AS evaluation
SET
  status = 'processing',
  attempt_count = 1,
  started_at = lease_time.acquired_at,
  lease_token =
    'cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd'::uuid,
  lease_expires_at =
    lease_time.acquired_at + interval '5 minutes'
FROM lease_time
WHERE evaluation.id = '99999999-9999-9999-9999-999999999991'::uuid;

ALTER TABLE public.interview_answer_evaluations
DISABLE TRIGGER trg_interview_answer_evaluation_contract;

WITH expired_time AS (
  SELECT pg_catalog.clock_timestamp() - interval '10 minutes' AS started_at
)
UPDATE public.interview_answer_evaluations AS evaluation
SET
  attempt_count = 3,
  started_at = expired_time.started_at,
  lease_expires_at = expired_time.started_at + interval '5 minutes'
FROM expired_time
WHERE evaluation.id = '99999999-9999-9999-9999-999999999991'::uuid;

ALTER TABLE public.interview_answer_evaluations
ENABLE TRIGGER trg_interview_answer_evaluation_contract;

SELECT throws_ok(
  $sql$
    UPDATE public.interview_answer_evaluations
    SET
      status = 'processing',
      attempt_count = 4,
      started_at = pg_catalog.clock_timestamp(),
      lease_token = pg_catalog.gen_random_uuid(),
      lease_expires_at =
        pg_catalog.clock_timestamp() + interval '5 minutes'
    WHERE id = '99999999-9999-9999-9999-999999999991'::uuid
  $sql$,
  'P0003',
  'RESOURCE_CONFLICT',
  'Expired evaluation at maximum attempts cannot be reclaimed'
);

DELETE FROM public.interview_answer_evaluations
WHERE id = '99999999-9999-9999-9999-999999999991'::uuid;

-- 5. Results Tests
insert into public.interview_session_results (id, user_id, interview_id, session_id, status, scoring_version, publication_version)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'pending', 1, 1);

update public.interview_session_results set status = 'partial' where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select throws_ok(
  'update public.interview_session_results set status = ''pending'' where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Partial to pending transition is rejected'
);

select throws_ok(
  'update public.interview_session_results set status = ''ready'' where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '23514',
  'new row for relation "interview_session_results" violates check constraint "chk_result_state_predicate"',
  'Ready transition fails without required score and summary fields'
);

select throws_ok(
  'UPDATE public.interview_session_results SET status = ''ready'', overall_score = 90, score_breakdown = ''{"44444444-4444-4444-4444-444444444444": 110, "66666666-6666-6666-6666-666666666666": 90, "88888888-8888-8888-8888-888888888888": 90}''::jsonb, strengths = ARRAY[''good''], improvement_summary = ''none'', generated_at = now() WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0015',
  'WORKER_VALIDATION_FAILED',
  'Ready transition fails with fractional or out-of-bounds score_breakdown'
);

UPDATE public.interview_session_results
SET status = 'ready', overall_score = 90, score_breakdown = (SELECT pg_catalog.jsonb_object_agg(session_question.id::text, 90) FROM public.interview_session_questions AS session_question WHERE session_question.session_id = '33333333-3333-3333-3333-333333333333'::uuid), strengths = ARRAY['Strong technical understanding']::text[], improvement_summary = 'Continue improving answer depth and examples.', generated_at = pg_catalog.clock_timestamp()
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid;

SELECT results_eq(
  'select status from public.interview_session_results where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY['ready'::text],
  'Valid partial to ready transition succeeds'
);

select throws_ok(
  'update public.interview_session_results set overall_score = 95 where id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0003',
  'RESOURCE_CONFLICT',
  'Ready results are immutable'
);

INSERT INTO public.interview_session_results (
  id,
  user_id,
  interview_id,
  session_id,
  status,
  scoring_version,
  publication_version
)
VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  'pending',
  1,
  99
);

UPDATE public.interview_session_results
SET status = 'failed'
WHERE id =
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

SELECT throws_ok(
  $sql$
    UPDATE public.interview_session_results
    SET status = 'pending'
    WHERE id =
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
  $sql$,
  'P0003',
  'RESOURCE_CONFLICT',
  'Failed results are immutable'
);

DELETE FROM public.interview_session_results
WHERE id =
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid;

INSERT INTO public.interview_session_results (
  id,
  user_id,
  interview_id,
  session_id,
  status,
  scoring_version,
  publication_version
)
VALUES (
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  'pending',
  2,
  2
);

UPDATE public.interview_session_results
SET
  status = 'ready',
  overall_score = 91,
  score_breakdown = (
    SELECT pg_catalog.jsonb_object_agg(
      session_question.id::text,
      91
    )
    FROM public.interview_session_questions AS session_question
    WHERE session_question.session_id =
      '33333333-3333-3333-3333-333333333333'::uuid
  ),
  strengths =
    ARRAY['Consistent performance across all questions']::text[],
  improvement_summary =
    'Continue strengthening technical examples and explanations.',
  generated_at = pg_catalog.clock_timestamp()
WHERE id =
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid;

INSERT INTO public.interview_answer_evaluations (
  id,
  user_id,
  interview_id,
  session_id,
  session_question_id,
  answer_id,
  status,
  evaluation_version,
  rubric_version,
  prompt_version,
  scoring_version
)
VALUES (
  '99999999-9999-9999-9999-999999999993'::uuid,
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid,
  '55555555-5555-5555-5555-555555555555'::uuid,
  'pending',
  3,
  1,
  1,
  1
);

WITH lease_time AS (
  SELECT pg_catalog.clock_timestamp() AS acquired_at
)
UPDATE public.interview_answer_evaluations AS evaluation
SET
  status = 'processing',
  attempt_count = 1,
  started_at = lease_time.acquired_at,
  lease_token =
    '93939393-9393-9393-9393-939393939393'::uuid,
  lease_expires_at =
    lease_time.acquired_at + interval '5 minutes'
FROM lease_time
WHERE evaluation.id =
  '99999999-9999-9999-9999-999999999993'::uuid;

UPDATE public.interview_answer_evaluations
SET
  status = 'completed',
  provider = 'test',
  model = 'test',
  completed_at = pg_catalog.clock_timestamp(),
  lease_token = NULL,
  lease_expires_at = NULL,
  overall_score = 92,
  dimension_scores = pg_catalog.jsonb_build_object(
    'technicalAccuracy', 92,
    'relevance', 92,
    'completeness', 92,
    'clarity', 92,
    'technicalDepth', 92
  ),
  strengths =
    ARRAY['Strong latest-version evaluation']::text[],
  improvement_areas =
    ARRAY['Continue adding detailed examples']::text[],
  student_feedback =
    'Latest completed evaluation selected correctly.'
WHERE id =
  '99999999-9999-9999-9999-999999999993'::uuid;

-- 6. Read RPCs and Concealment Tests
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

SELECT results_eq(
  $actual$
    SELECT session_question_id
    FROM public.student_list_session_answers(
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    )
  $actual$,
  $expected$
    VALUES
      ('66666666-6666-6666-6666-666666666666'::uuid),
      ('88888888-8888-8888-8888-888888888888'::uuid),
      ('44444444-4444-4444-4444-444444444444'::uuid)
  $expected$,
  'student_list_session_answers follows display_order then session_question_id'
);

SELECT is(
  (select status from public.student_get_session_answer('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')),
  'finalized'::text,
  'student_get_session_answer returns the correct answer'
);

SELECT results_eq(
  $$ select overall_score, evaluation_version from public.student_get_answer_evaluation('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444') $$,
  $$ VALUES (92::integer, 3::integer) $$,
  'student_get_answer_evaluation returns latest evaluation data safely'
);

SELECT is(
  (SELECT NOT (pg_catalog.to_jsonb(evaluation_row) ?| ARRAY['provider', 'model']) FROM public.student_get_answer_evaluation('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444') AS evaluation_row),
  true,
  'Evaluation RPC excludes provider and model'
);

SELECT is(
  (SELECT NOT (pg_catalog.to_jsonb(evaluation_row) ?| ARRAY['lease_token', 'lease_expires_at', 'evaluator_metadata']) FROM public.student_get_answer_evaluation('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444') AS evaluation_row),
  true,
  'Evaluation RPC excludes worker execution fields'
);

SELECT results_eq(
  $$ select overall_score, publication_version from public.student_get_latest_session_result('22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  $$ VALUES (91::integer, 2::integer) $$,
  'student_get_latest_session_result returns correct latest version data'
);


-- Unauthorized / Non-owner context
RESET ROLE;
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ('11111111-1111-1111-1111-111111111112'::uuid, 'phase6-nonowner@example.com', '{"fullName":"Phase 6 Non Owner"}'::jsonb);
UPDATE public.users SET role = 'student', account_status = 'active' WHERE id = '11111111-1111-1111-1111-111111111112'::uuid;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111112","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

select throws_ok(
  'select * from public.student_list_session_answers(''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')',
  'P0002',
  'RESOURCE_NOT_FOUND',
  'RPC securely conceals answers for active non-owner'
);

select throws_ok(
  'select * from public.student_get_latest_session_result(''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')',
  'P0002',
  'RESOURCE_NOT_FOUND',
  'RPC securely conceals result for active non-owner'
);

RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
select throws_ok(
  'select * from public.student_get_session_answer(''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'', ''55555555-5555-5555-5555-555555555555'')',
  'P0002',
  'RESOURCE_NOT_FOUND',
  'Active owner requesting missing answer receives RESOURCE_NOT_FOUND'
);

RESET ROLE;
UPDATE public.users SET account_status = 'suspended' WHERE id = '11111111-1111-1111-1111-111111111112'::uuid;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111112","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
select throws_ok(
  'select * from public.student_get_latest_session_result(''22222222-2222-2222-2222-222222222222'', ''33333333-3333-3333-3333-333333333333'')',
  'P0001',
  'FORBIDDEN_ACCESS',
  'Suspended user calling read RPC receives FORBIDDEN_ACCESS'
);

select * from finish();
rollback;
