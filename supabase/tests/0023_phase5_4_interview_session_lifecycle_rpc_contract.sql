BEGIN;
SELECT plan(43);

-- 1. Function security: Verify private engine
SELECT has_function('private', 'transition_interview_session_lifecycle', ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'], 'Private transition function should exist');
SELECT function_owner_is('private', 'transition_interview_session_lifecycle', ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'], 'postgres', 'Private function owned by postgres');

-- 2. Function security: Verify public wrappers
SELECT has_function('public', 'student_start_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'Public start function exists');
SELECT function_owner_is('public', 'student_start_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'postgres', 'Public start function owned by postgres');
SELECT function_privs_are('public', 'student_start_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'anon', ARRAY[]::text[], 'anon has no access');
SELECT function_privs_are('public', 'student_start_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'public', ARRAY[]::text[], 'public has no access');

SELECT has_function('public', 'student_pause_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'Public pause function exists');
SELECT has_function('public', 'student_resume_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'Public resume function exists');
SELECT has_function('public', 'student_complete_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'Public complete function exists');

-- 3. Verify security definer and search_path
SELECT is_definer('private', 'transition_interview_session_lifecycle', ARRAY['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text', 'text'], 'transition_interview_session_lifecycle must be security definer');
SELECT is_definer('public', 'student_start_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'public wrapper must be security definer');
SELECT is_definer('public', 'student_pause_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'public wrapper must be security definer');
SELECT is_definer('public', 'student_resume_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'public wrapper must be security definer');
SELECT is_definer('public', 'student_complete_interview_session', ARRAY['uuid', 'uuid', 'text', 'text'], 'public wrapper must be security definer');

-- 4. Verify trigger on interview_sessions
SELECT has_trigger('public', 'interview_sessions', 'set_interview_sessions_updated_at', 'Trigger set_interview_sessions_updated_at should exist');

-- 5. Functional Execution of Lifecycle
-- Setup Data for Execution
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00230000-0000-0000-0000-000000000001', 'p54-lifecycle@example.test', '{"fullName":"P5.4 Lifecycle Student"}'::jsonb);
UPDATE public.users SET role = 'student', account_status = 'active' WHERE id = '00230000-0000-0000-0000-000000000001';

-- Taxonomy test data
INSERT INTO public.question_interview_types (id, name, slug) VALUES ('00230000-0000-0000-0001-000000000001', 'Type 1', 'type-1-23');
INSERT INTO public.question_difficulties (id, name, slug) VALUES ('00230000-0000-0000-0002-000000000001', 'Diff 1', 'diff-1-23');

-- Create interviews and mappings for tests
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES
  ('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000001', 'Lifecycle Test Interview', 'Tester', '00230000-0000-0000-0001-000000000001', '00230000-0000-0000-0002-000000000001', 5),
  ('00230000-0000-0000-0000-000000000099', '00230000-0000-0000-0000-000000000001', 'Mismatched Interview', 'Tester', '00230000-0000-0000-0001-000000000001', '00230000-0000-0000-0002-000000000001', 5);

INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot)
VALUES ('00230000-0000-0000-0000-000000000003', '00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000001', 'ready', '{}');

-- Removed DELETE FROM public.audit_logs to prevent mutating immutable data

-- START transition and audit insertion verification
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT results_eq(
  $$ SELECT (public.student_start_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-1', 'rh-1'))->'snapshot'->>'status' $$,
  $$ VALUES ('in_progress') $$,
  'Starting a session updates status to in_progress'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT status::text FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('in_progress') $$,
  'Session state is persisted as in_progress'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_STARTED' AND resource_type = 'interview_session' AND resource_id = '00230000-0000-0000-0000-000000000003' AND actor_user_id = '00230000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'Exactly one audit row written for INTERVIEW_SESSION_STARTED'
);

SELECT results_eq(
  $$ SELECT (started_at IS NOT NULL)::boolean FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003' $$,
  $$ VALUES (true) $$,
  'Start timestamp persists'
);

SELECT results_eq(
  $$ SELECT status::text FROM public.idempotency_records WHERE idempotency_key = 'ik-1' AND resource_id = '00230000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('completed') $$,
  'Idempotency completion persists'
);

-- REPLAY audit-bypass verification
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT results_eq(
  $$ SELECT ((public.student_start_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-1', 'rh-1'))->>'replayed')::boolean $$,
  $$ VALUES (true) $$,
  'Replaying with the same fingerprint marks response as replayed'
);

SELECT results_eq(
  $$ SELECT (public.student_start_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-1', 'rh-1'))->'snapshot'->>'status' $$,
  $$ VALUES ('in_progress') $$,
  'Replayed snapshot matches completed response'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_STARTED' AND actor_user_id = '00230000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'Audit-row count for INTERVIEW_SESSION_STARTED remains exactly one after replay'
);

-- FINGERPRINT-CONFLICT verification
-- Store session state right before fingerprint conflict
CREATE TEMP TABLE temp_conflict_state AS SELECT * FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$ SELECT public.student_start_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-1', 'rh-conflict') $$,
  'P0003',
  'IDEMPOTENCY_CONFLICT',
  'Different fingerprint with same idempotency key yields IDEMPOTENCY_CONFLICT'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_STARTED' AND actor_user_id = '00230000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'No new audit row inserted during fingerprint conflict'
);

SELECT results_eq(
  $$
    SELECT
      status::text,
      started_at,
      paused_at,
      completed_at,
      total_paused_seconds
    FROM public.interview_sessions
    WHERE id = '00230000-0000-0000-0000-000000000003'
  $$,
  $$
    SELECT
      status::text,
      started_at,
      paused_at,
      completed_at,
      total_paused_seconds
    FROM temp_conflict_state
  $$,
  'Fingerprint conflict leaves session lifecycle state unchanged'
);

-- PAUSE and RESUME transitions
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT results_eq(
  $$ SELECT (public.student_pause_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-2', 'rh-2'))->'snapshot'->>'status' $$,
  $$ VALUES ('paused') $$,
  'Pausing a session updates status to paused'
);

SELECT results_eq(
  $$ SELECT (public.student_resume_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-3', 'rh-3'))->'snapshot'->>'status' $$,
  $$ VALUES ('in_progress') $$,
  'Resuming a session updates status to in_progress'
);

RESET ROLE;

-- INTERVIEW/SESSION mismatch verification
-- Store session state right before mismatch conflict
CREATE TEMP TABLE temp_mismatch_state AS SELECT * FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$ SELECT public.student_pause_interview_session('00230000-0000-0000-0000-000000000099', '00230000-0000-0000-0000-000000000003', 'ik-mismatch', 'rh-mismatch') $$,
  'P0002',
  'RESOURCE_NOT_FOUND',
  'Mismatched interview ID and session ID throws RESOURCE_NOT_FOUND'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_PAUSED' AND actor_user_id = '00230000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'No lifecycle audit row inserted for mismatched resource'
);

SELECT results_eq(
  $$
    SELECT
      status::text,
      started_at,
      paused_at,
      completed_at,
      total_paused_seconds
    FROM public.interview_sessions
    WHERE id = '00230000-0000-0000-0000-000000000003'
  $$,
  $$
    SELECT
      status::text,
      started_at,
      paused_at,
      completed_at,
      total_paused_seconds
    FROM temp_mismatch_state
  $$,
  'Mismatched interview/session request leaves session unchanged'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.idempotency_records WHERE idempotency_key = 'ik-mismatch' AND status = 'completed' $$,
  $$ VALUES (0) $$,
  'No completed idempotency response persisted for mismatched resource'
);

-- INVALID TRANSITION ATOMICITY verification
-- Move to completed first
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT results_eq(
  $$ SELECT (public.student_complete_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-4', 'rh-4'))->'snapshot'->>'status' $$,
  $$ VALUES ('completed') $$,
  'Completing a session updates status to completed'
);

RESET ROLE;

-- Store completed_at
CREATE TEMP TABLE temp_timestamps AS SELECT completed_at FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003';

-- Invalid transition
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$ SELECT public.student_pause_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000003', 'ik-5', 'rh-5') $$,
  'P0003',
  'RESOURCE_CONFLICT',
  'Cannot transition from completed to paused'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT status::text FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000003' $$,
  $$ VALUES ('completed') $$,
  'Session remains completed after invalid transition'
);

SELECT results_eq(
  $$ SELECT (i.completed_at = t.completed_at)::boolean FROM public.interview_sessions i CROSS JOIN temp_timestamps t WHERE i.id = '00230000-0000-0000-0000-000000000003' $$,
  $$ VALUES (true) $$,
  'completed_at remains unchanged after invalid transition'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_PAUSED' AND actor_user_id = '00230000-0000-0000-0000-000000000001' $$,
  $$ VALUES (1) $$,
  'No new audit row inserted for invalid transition'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.idempotency_records WHERE idempotency_key = 'ik-5' AND status = 'completed' $$,
  $$ VALUES (0) $$,
  'No successful idempotency completion recorded for invalid transition'
);

-- ROLLBACK verification via forcing idempotency completion failure
-- Add a fresh session to test rollback against
INSERT INTO public.interview_sessions (id, interview_id, user_id, status, config_snapshot)
VALUES ('00230000-0000-0000-0000-000000000004', '00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000001', 'ready', '{}');

-- We shadow the public.complete_idempotency_lease function temporarily to force XX000 via failure to complete
CREATE OR REPLACE FUNCTION public.complete_idempotency_lease(
    p_record_id UUID, p_lease_token UUID, p_response_status INT, p_response_body JSONB
) RETURNS BOOLEAN LANGUAGE plpgsql AS $f$ BEGIN RETURN FALSE; END; $f$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', '00230000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);

SELECT throws_ok(
  $$ SELECT public.student_start_interview_session('00230000-0000-0000-0000-000000000002', '00230000-0000-0000-0000-000000000004', 'ik-rollback', 'rh-rollback') $$,
  'XX000',
  'IDEMPOTENCY_COMPLETION_FAILED',
  'Forced completion failure yields OPERATION_FAILED (XX000) exception'
);

RESET ROLE;

SELECT results_eq(
  $$ SELECT status::text FROM public.interview_sessions WHERE id = '00230000-0000-0000-0000-000000000004' $$,
  $$ VALUES ('ready') $$,
  'Session state remains unchanged (ready) after rollback'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.audit_logs WHERE resource_id = '00230000-0000-0000-0000-000000000004' $$,
  $$ VALUES (0) $$,
  'No lifecycle audit row persists after rollback'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.idempotency_records WHERE idempotency_key = 'ik-rollback' AND status = 'completed' $$,
  $$ VALUES (0) $$,
  'No completed idempotency response persists after rollback'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM public.idempotency_records WHERE idempotency_key = 'ik-rollback' AND resource_id = '00230000-0000-0000-0000-000000000004' $$,
  $$ VALUES (0) $$,
  'No leaked resource binding persists after rollback'
);

SELECT * FROM finish();
ROLLBACK;
