begin;
select plan(48);

-- =================================================================
-- Test 26: P6.3 Answer Mutation RPC Contract
--   Validates function existence, ownership, security posture,
--   privilege grants, and behavioral integration for:
--     - student_save_draft_answer
--     - student_update_draft_answer
--     - student_finalize_answer
--     - student_complete_interview_session (extended behavior)
-- =================================================================

-- 1. Function existence checks
SELECT has_function('public', 'student_save_draft_answer',
  ARRAY['uuid','uuid','uuid','text','text','jsonb','text','text'],
  'student_save_draft_answer function exists');

SELECT has_function('public', 'student_update_draft_answer',
  ARRAY['uuid','uuid','uuid','integer','text','jsonb','text','text'],
  'student_update_draft_answer function exists');

SELECT has_function('public', 'student_finalize_answer',
  ARRAY['uuid','uuid','uuid','integer','text','text'],
  'student_finalize_answer function exists');

-- 2. Function ownership
SELECT function_owner_is('public', 'student_save_draft_answer',
  ARRAY['uuid','uuid','uuid','text','text','jsonb','text','text'],
  'postgres', 'student_save_draft_answer owned by postgres');

SELECT function_owner_is('public', 'student_update_draft_answer',
  ARRAY['uuid','uuid','uuid','integer','text','jsonb','text','text'],
  'postgres', 'student_update_draft_answer owned by postgres');

SELECT function_owner_is('public', 'student_finalize_answer',
  ARRAY['uuid','uuid','uuid','integer','text','text'],
  'postgres', 'student_finalize_answer owned by postgres');

-- 3. SECURITY DEFINER checks
SELECT is_definer('public', 'student_save_draft_answer',
  ARRAY['uuid','uuid','uuid','text','text','jsonb','text','text'],
  'student_save_draft_answer is SECURITY DEFINER');

SELECT is_definer('public', 'student_update_draft_answer',
  ARRAY['uuid','uuid','uuid','integer','text','jsonb','text','text'],
  'student_update_draft_answer is SECURITY DEFINER');

SELECT is_definer('public', 'student_finalize_answer',
  ARRAY['uuid','uuid','uuid','integer','text','text'],
  'student_finalize_answer is SECURITY DEFINER');

-- 4. Privilege checks: anon has no access
SELECT function_privs_are('public', 'student_save_draft_answer',
  ARRAY['uuid','uuid','uuid','text','text','jsonb','text','text'],
  'anon', ARRAY[]::text[], 'anon cannot execute student_save_draft_answer');

SELECT function_privs_are('public', 'student_update_draft_answer',
  ARRAY['uuid','uuid','uuid','integer','text','jsonb','text','text'],
  'anon', ARRAY[]::text[], 'anon cannot execute student_update_draft_answer');

SELECT function_privs_are('public', 'student_finalize_answer',
  ARRAY['uuid','uuid','uuid','integer','text','text'],
  'anon', ARRAY[]::text[], 'anon cannot execute student_finalize_answer');

-- 5. Privilege checks: public has no access
SELECT function_privs_are('public', 'student_save_draft_answer',
  ARRAY['uuid','uuid','uuid','text','text','jsonb','text','text'],
  'public', ARRAY[]::text[], 'public cannot execute student_save_draft_answer');

SELECT function_privs_are('public', 'student_update_draft_answer',
  ARRAY['uuid','uuid','uuid','integer','text','jsonb','text','text'],
  'public', ARRAY[]::text[], 'public cannot execute student_update_draft_answer');

SELECT function_privs_are('public', 'student_finalize_answer',
  ARRAY['uuid','uuid','uuid','integer','text','text'],
  'public', ARRAY[]::text[], 'public cannot execute student_finalize_answer');

-- 6. student_complete_interview_session: still exists with original signature
SELECT has_function('public', 'student_complete_interview_session',
  ARRAY['uuid','uuid','text','text'],
  'student_complete_interview_session exists with original signature');

SELECT is_definer('public', 'student_complete_interview_session',
  ARRAY['uuid','uuid','text','text'],
  'student_complete_interview_session is SECURITY DEFINER');

-- 7. FUNCTIONAL EXECUTION TESTS

-- Setup: insert test users
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-100000000000', 'admin@test.local',
   '{"fullName":"Admin"}'::jsonb),
  ('00260000-0000-0000-0000-000000000001', 'p63-student@example.test',
   '{"fullName":"P6.3 Student"}'::jsonb);
UPDATE public.users
SET role = 'admin', account_status = 'active'
WHERE id = '00000000-0000-0000-0000-100000000000';
UPDATE public.users
SET role = 'student', account_status = 'active'
WHERE id = '00260000-0000-0000-0000-000000000001';

-- Taxonomy seeds
INSERT INTO public.question_interview_types (id, name, slug) VALUES
  ('00260000-0000-0000-0001-000000000001', 'Type P6.3', 'type-p63');
INSERT INTO public.question_difficulties (id, name, slug) VALUES
  ('00260000-0000-0000-0002-000000000001', 'Diff P6.3', 'diff-p63');
INSERT INTO public.question_categories (id, name, slug) VALUES
  ('00260000-0000-0000-0003-000000000001', 'Cat P6.3', 'cat-p63');
INSERT INTO public.questions (id, question_text, interview_type_id, difficulty_id, category_id, created_by) VALUES
  ('00260000-0000-0000-0004-000000000001', 'Question A p6.3',
   '00260000-0000-0000-0001-000000000001', '00260000-0000-0000-0002-000000000001',
   '00260000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-100000000000'),
  ('00260000-0000-0000-0004-000000000002', 'Question B p6.3',
   '00260000-0000-0000-0001-000000000001', '00260000-0000-0000-0002-000000000001',
   '00260000-0000-0000-0003-000000000001', '00000000-0000-0000-0000-100000000000');

-- Interview + session
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00260000-0000-0000-0000-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'P6.3 Test Interview', 'Engineer',
        '00260000-0000-0000-0001-000000000001',
        '00260000-0000-0000-0002-000000000001', 2);

INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot, started_at, created_at, updated_at, last_transition_at)
VALUES ('00260000-0000-0000-0000-000000000003',
        '00260000-0000-0000-0000-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'in_progress', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

-- Session questions
INSERT INTO public.interview_session_questions
  (id, session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES
  ('00260000-0000-0000-0000-000000000004',
   '00260000-0000-0000-0000-000000000003',
   '00260000-0000-0000-0004-000000000001', 1, 'Question A p6.3',
   jsonb_build_object(
     'category', jsonb_build_object('id', '00260000-0000-0000-0003-000000000001', 'name', 'Cat P6.3'),
     'difficulty', jsonb_build_object('id', '00260000-0000-0000-0002-000000000001', 'name', 'Diff P6.3'),
     'interviewType', jsonb_build_object('id', '00260000-0000-0000-0001-000000000001', 'name', 'Type P6.3'),
     'skills', '[]'::jsonb,
     'topics', '[]'::jsonb,
     'sourceQuestionId', '00260000-0000-0000-0004-000000000001',
     'capturedAt', '2026-01-01T00:00:00Z'
   )),
  ('00260000-0000-0000-0000-000000000005',
   '00260000-0000-0000-0000-000000000003',
   '00260000-0000-0000-0004-000000000002', 2, 'Question B p6.3',
   jsonb_build_object(
     'category', jsonb_build_object('id', '00260000-0000-0000-0003-000000000001', 'name', 'Cat P6.3'),
     'difficulty', jsonb_build_object('id', '00260000-0000-0000-0002-000000000001', 'name', 'Diff P6.3'),
     'interviewType', jsonb_build_object('id', '00260000-0000-0000-0001-000000000001', 'name', 'Type P6.3'),
     'skills', '[]'::jsonb,
     'topics', '[]'::jsonb,
     'sourceQuestionId', '00260000-0000-0000-0004-000000000002',
     'capturedAt', '2026-01-01T00:00:00Z'
   ));

-- Separate session for code draft
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00260000-0000-0000-0001-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'P6.3 Code Draft Interview', 'Engineer',
        '00260000-0000-0000-0001-000000000001',
        '00260000-0000-0000-0002-000000000001', 1);

INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot, started_at, created_at, updated_at, last_transition_at)
VALUES ('00260000-0000-0000-0001-000000000003',
        '00260000-0000-0000-0001-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'in_progress', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO public.interview_session_questions
  (id, session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES
  ('00260000-0000-0000-0001-000000000004',
   '00260000-0000-0000-0001-000000000003',
   '00260000-0000-0000-0004-000000000001', 1, 'Question A p6.3',
   jsonb_build_object(
     'category', jsonb_build_object('id', '00260000-0000-0000-0003-000000000001', 'name', 'Cat P6.3'),
     'difficulty', jsonb_build_object('id', '00260000-0000-0000-0002-000000000001', 'name', 'Diff P6.3'),
     'interviewType', jsonb_build_object('id', '00260000-0000-0000-0001-000000000001', 'name', 'Type P6.3'),
     'skills', '[]'::jsonb,
     'topics', '[]'::jsonb,
     'sourceQuestionId', '00260000-0000-0000-0004-000000000001',
     'capturedAt', '2026-01-01T00:00:00Z'
   ));

-- Separate session for P0014 skipped answer
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00260000-0000-0000-0002-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'P6.3 Skipped Answer Interview', 'Engineer',
        '00260000-0000-0000-0001-000000000001',
        '00260000-0000-0000-0002-000000000001', 1);

INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot, started_at, created_at, updated_at, last_transition_at)
VALUES ('00260000-0000-0000-0002-000000000003',
        '00260000-0000-0000-0002-000000000002',
        '00260000-0000-0000-0000-000000000001',
        'in_progress', '{}', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT INTO public.interview_session_questions
  (id, session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES
  ('00260000-0000-0000-0002-000000000004',
   '00260000-0000-0000-0002-000000000003',
   '00260000-0000-0000-0004-000000000001', 1, 'Question A p6.3',
   jsonb_build_object(
     'category', jsonb_build_object('id', '00260000-0000-0000-0003-000000000001', 'name', 'Cat P6.3'),
     'difficulty', jsonb_build_object('id', '00260000-0000-0000-0002-000000000001', 'name', 'Diff P6.3'),
     'interviewType', jsonb_build_object('id', '00260000-0000-0000-0001-000000000001', 'name', 'Type P6.3'),
     'skills', '[]'::jsonb,
     'topics', '[]'::jsonb,
     'sourceQuestionId', '00260000-0000-0000-0004-000000000001',
     'capturedAt', '2026-01-01T00:00:00Z'
   ));

INSERT INTO public.interview_session_answers (
    user_id, interview_id, session_id, session_question_id,
    response_type, text_response, code_response,
    status, version, finalized_at, skipped_at, created_at, updated_at
) VALUES (
    '00260000-0000-0000-0000-000000000001',
    '00260000-0000-0000-0002-000000000002',
    '00260000-0000-0000-0002-000000000003',
    '00260000-0000-0000-0002-000000000004',
    NULL, NULL, NULL,
    'skipped', 1, NULL, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'
);

-- Activate session context
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '00260000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

-- 8. Save draft answer — happy path returns 201 with status=draft
SELECT results_eq(
  $$
    SELECT (public.student_save_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      'text', 'My draft answer', NULL,
      'ik-save-1', 'rh-save-1'
    ))->'snapshot'->>'status'
  $$,
  $$ VALUES ('draft') $$,
  'student_save_draft_answer returns snapshot.status = draft'
);

-- Missing Assertion 1: Save draft with code payload
SELECT results_eq(
  $query$
    SELECT
      (result->>'replayed')::boolean,
      (result->>'response_status')::integer,
      result->'snapshot'->>'status',
      (result->'snapshot'->>'version')::integer,
      result->'snapshot'->>'responseType',
      result->'snapshot'->'codeResponse'->>'source',
      result->'snapshot'->'codeResponse'->>'language',
      result->'snapshot'->'codeResponse'->>'explanation'
    FROM (
      SELECT public.student_save_draft_answer(
        '00260000-0000-0000-0001-000000000002',
        '00260000-0000-0000-0001-000000000003',
        '00260000-0000-0000-0001-000000000004',
        'code', NULL, '{"source":"console.log()","language":"javascript","explanation":"test"}',
        'ik-save-code-1', 'rh-save-code-1'
      ) AS result
    ) AS rpc
  $query$,
  $expected$
    VALUES (
      false,
      201,
      'draft',
      1,
      'code',
      'console.log()',
      'javascript',
      'test'
    )
  $expected$,
  'Code draft RPC returns the canonical persisted snapshot'
);

SELECT results_eq(
  $$
    SELECT (public.student_save_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      'text', 'My draft answer', NULL,
      'ik-save-1', 'rh-save-1'
    ))->>'replayed'
  $$,
  $$ VALUES ('true') $$,
  'student_save_draft_answer replays correctly for same idempotency-key'
);

-- Missing Assertion 2: Idempotency conflict (different hash)
SELECT throws_ok(
  $$
    SELECT public.student_save_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      'text', 'My draft answer diff', NULL,
      'ik-save-1', 'rh-save-diff'
    )
  $$,
  'P0007', 'IDEMPOTENCY_CONFLICT',
  'student_save_draft_answer raises IDEMPOTENCY_CONFLICT on hash mismatch'
);

-- 9. answer row is persisted
RESET ROLE;
SELECT results_eq(
  $$ SELECT status::text FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES ('draft') $$,
  'Draft answer row persisted with status=draft'
);

SELECT results_eq(
  $$ SELECT version FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES (1) $$,
  'Draft answer starts at version=1'
);

-- 10. Audit row created for draft creation
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs
     WHERE action = 'ANSWER_DRAFT_CREATED'
       AND resource_type = 'interview_session_answer'
       AND (metadata->>'session_question_id')::uuid = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES (1) $$,
  'ANSWER_DRAFT_CREATED audit row written specifically for Q1'
);

-- 11. Update draft answer
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '00260000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

SELECT results_eq(
  $$
    SELECT (public.student_update_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      1,
      'My updated draft answer', NULL,
      'ik-update-1', 'rh-update-1'
    ))->'snapshot'->>'status'
  $$,
  $$ VALUES ('draft') $$,
  'student_update_draft_answer returns status=draft'
);

-- Missing Assertion 3: Stale update conflict (P0012)
SELECT throws_ok(
  $$
    SELECT public.student_update_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      1,
      'My stale updated draft answer', NULL,
      'ik-update-stale', 'rh-update-stale'
    )
  $$,
  'P0012', 'STALE_UPDATE_CONFLICT',
  'student_update_draft_answer raises STALE_UPDATE_CONFLICT for outdated version'
);

-- 12. version incremented
RESET ROLE;
SELECT results_eq(
  $$ SELECT version FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES (2) $$,
  'Draft answer version incremented to 2 after update'
);

-- 13. Finalize answer context
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '00260000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

-- Missing Assertion 4: Finalize version CAS (P0012)
SELECT throws_ok(
  $$
    SELECT public.student_finalize_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      0, -- invalid version
      'ik-finalize-bad-version', 'rh-finalize-bad-version'
    )
  $$,
  'P0012', 'STALE_UPDATE_CONFLICT',
  'student_finalize_answer raises STALE_UPDATE_CONFLICT on wrong version'
);

-- 13. Finalize answer
SELECT results_eq(
  $$
    SELECT (public.student_finalize_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      2,
      'ik-finalize-1', 'rh-finalize-1'
    ))->'snapshot'->>'status'
  $$,
  $$ VALUES ('finalized') $$,
  'student_finalize_answer returns status=finalized'
);

-- 14. Finalized answer is immutable — second finalize attempt returns ANSWER_IMMUTABLE
SELECT throws_ok(
  $$
    SELECT public.student_finalize_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      3,
      'ik-finalize-2', 'rh-finalize-2'
    )
  $$,
  'P0013', 'ANSWER_IMMUTABLE',
  'Finalizing an already-finalized answer raises P0013 ANSWER_IMMUTABLE'
);

-- Missing Assertion 5: Update finalized answer (P0013)
SELECT throws_ok(
  $$
    SELECT public.student_update_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000004',
      3,
      'My updated finalized answer', NULL,
      'ik-update-finalized', 'rh-update-finalized'
    )
  $$,
  'P0013', 'ANSWER_IMMUTABLE',
  'Updating an already-finalized answer raises P0013 ANSWER_IMMUTABLE'
);

RESET ROLE;

-- 15. Finalized answer persisted
SELECT results_eq(
  $$ SELECT status::text FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES ('finalized') $$,
  'Answer row status=finalized after finalize'
);

SELECT results_eq(
  $$ SELECT (finalized_at IS NOT NULL)::boolean FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES (true) $$,
  'finalized_at timestamp is set'
);

-- 16. Complete session: Q1 already finalized, Q2 has no answer (will be skipped)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '00260000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

SELECT results_eq(
  $$
    SELECT (public.student_complete_interview_session(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      'ik-complete-1', 'rh-complete-1'
    ))->'snapshot'->>'status'
  $$,
  $$ VALUES ('completed') $$,
  'student_complete_interview_session returns status=completed'
);

-- Missing Assertion 6: Save draft to completed session (P0011)
SELECT throws_ok(
  $$
    SELECT public.student_save_draft_answer(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      '00260000-0000-0000-0000-000000000005',
      'text', 'Late draft', NULL,
      'ik-save-late', 'rh-save-late'
    )
  $$,
  'P0011', 'SESSION_TERMINAL',
  'student_save_draft_answer raises SESSION_TERMINAL on completed session'
);

-- Missing Assertion 7: Update draft on completed session (P0014 on skipped answer)
SELECT throws_ok(
  $$
    SELECT public.student_update_draft_answer(
      '00260000-0000-0000-0002-000000000002',
      '00260000-0000-0000-0002-000000000003',
      '00260000-0000-0000-0002-000000000004',
      1,
      'Late update', NULL,
      'ik-update-late', 'rh-update-late'
    )
  $$,
  'P0014', 'ANSWER_SKIPPED',
  'Updating a skipped answer raises P0014 ANSWER_SKIPPED'
);

-- Missing Assertion 8: Finalize skipped answer (P0014)
SELECT throws_ok(
  $$
    SELECT public.student_finalize_answer(
      '00260000-0000-0000-0002-000000000002',
      '00260000-0000-0000-0002-000000000003',
      '00260000-0000-0000-0002-000000000004',
      1,
      'ik-finalize-late', 'rh-finalize-late'
    )
  $$,
  'P0014', 'ANSWER_SKIPPED',
  'Finalizing a skipped answer raises P0014 ANSWER_SKIPPED'
);

RESET ROLE;

-- 17. Session row is completed
SELECT results_eq(
  $$ SELECT status::text FROM public.interview_sessions
     WHERE id = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('completed') $$,
  'Session status transitioned to completed'
);

-- 18. Q2 was skipped
SELECT results_eq(
  $$ SELECT status::text FROM public.interview_session_answers
     WHERE session_question_id = '00260000-0000-0000-0000-000000000005' $$,
  $$ VALUES ('skipped') $$,
  'Unanswered question Q2 was auto-skipped on completion'
);

-- 19. Evaluations created: one pending (Q1) + one skipped (Q2)
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.interview_answer_evaluations
     WHERE session_id = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES (2) $$,
  'Exactly 2 evaluation rows created on session completion'
);

SELECT results_eq(
  $$ SELECT status::text FROM public.interview_answer_evaluations
     WHERE session_id = '00260000-0000-0000-0000-000000000003'
       AND session_question_id = '00260000-0000-0000-0000-000000000004' $$,
  $$ VALUES ('pending') $$,
  'Evaluation for finalized answer Q1 is pending'
);

SELECT results_eq(
  $$ SELECT status::text FROM public.interview_answer_evaluations
     WHERE session_id = '00260000-0000-0000-0000-000000000003'
       AND session_question_id = '00260000-0000-0000-0000-000000000005' $$,
  $$ VALUES ('skipped') $$,
  'Evaluation for skipped answer Q2 is skipped'
);

-- 20. Session result created as pending
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.interview_session_results
     WHERE session_id = '00260000-0000-0000-0000-000000000003'
       AND status = 'pending' $$,
  $$ VALUES (1) $$,
  'Exactly one pending session result created on completion'
);

-- 21. AUDIT: INTERVIEW_SESSION_COMPLETED written
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs
     WHERE action = 'INTERVIEW_SESSION_COMPLETED'
       AND resource_id = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES (1) $$,
  'INTERVIEW_SESSION_COMPLETED audit row written'
);

-- Test 45 and 46 replaced with replay assertions above

-- 22. AUDIT: EVALUATION_QUEUED written for both questions
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs
     WHERE action = 'EVALUATION_QUEUED'
       AND (metadata->>'session_id')::uuid = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES (2) $$,
  'EVALUATION_QUEUED audit rows written for both questions'
);

-- 23. Completion replay returns replayed=true
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  json_build_object('sub', '00260000-0000-0000-0000-000000000001',
                    'role', 'authenticated')::text, true);

SELECT results_eq(
  $$
    SELECT (public.student_complete_interview_session(
      '00260000-0000-0000-0000-000000000002',
      '00260000-0000-0000-0000-000000000003',
      'ik-complete-1', 'rh-complete-1'
    ))->>'replayed'
  $$,
  $$ VALUES ('true') $$,
  'student_complete_interview_session replays correctly for same idempotency-key'
);

RESET ROLE;

-- Missing Assertion 9: Replay duplicate safety check (evaluations)
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.interview_answer_evaluations
     WHERE session_id = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES (2) $$,
  'Replay creates no duplicate answer evaluations'
);

-- Missing Assertion 10: Replay duplicate safety check (results)
SELECT results_eq(
  $$ SELECT count(*)::int FROM public.interview_session_results
     WHERE session_id = '00260000-0000-0000-0000-000000000003' $$,
  $$ VALUES (1) $$,
  'Replay creates no duplicate session-result publications'
);

RESET ROLE;

SELECT * FROM finish();
rollback;
