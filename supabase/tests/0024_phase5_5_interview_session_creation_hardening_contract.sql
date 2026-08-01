BEGIN;
SELECT plan(18);

-- Setup
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000001', 'test1@example.com', '{"fullName":"Test User One"}'::jsonb),
       ('00000000-0000-0000-0000-000000000002', 'test2@example.com', '{"fullName":"Test User Two"}'::jsonb);

UPDATE public.users SET role = 'student', account_status = 'active'
WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

INSERT INTO public.question_interview_types (id, name, slug) VALUES ('00000000-0000-0000-0001-000000000001', 'Type 1', 'type-1');
INSERT INTO public.question_difficulties (id, name, slug) VALUES ('00000000-0000-0000-0002-000000000001', 'Diff 1', 'diff-1');
INSERT INTO public.question_skills (id, name, slug) VALUES ('00000000-0000-0000-0003-000000000001', 'Skill 1', 'skill-1');
INSERT INTO public.question_topics (id, name, slug) VALUES ('00000000-0000-0000-0004-000000000001', 'Topic 1', 'topic-1');
INSERT INTO public.question_categories (id, name, slug) VALUES ('00000000-0000-0000-0005-000000000001', 'Cat 1', 'cat-1');

INSERT INTO public.questions (id, created_by, category_id, interview_type_id, difficulty_id, question_text, status)
VALUES
('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Explain how dependency injection improves modularity and testability in a Node.js backend application.', 'draft'),
('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Describe how database transactions preserve consistency during concurrent interview session creation.', 'draft');

INSERT INTO public.question_internal_data (question_id, reference_answer, evaluation_guidance)
VALUES ('00000000-0000-0000-0006-000000000001', 'Ref ans', '{"guide": "test"}'),
       ('00000000-0000-0000-0006-000000000002', 'Ref ans', '{"guide": "test"}');

INSERT INTO public.question_skill_mappings (question_id, skill_id)
VALUES ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0003-000000000001'),
       ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0003-000000000001');

INSERT INTO public.question_topic_mappings (question_id, topic_id)
VALUES ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0004-000000000001'),
       ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0004-000000000001');

UPDATE public.questions
SET status = 'published'
WHERE id IN ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0006-000000000002');

INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', 'Test', 'Test', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 2);
INSERT INTO public.interview_skill_mappings (interview_id, skill_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0003-000000000001');

INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0000-000000000001', 'Test 2', 'Test 2', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 2);
INSERT INTO public.interview_skill_mappings (interview_id, skill_id) VALUES ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0003-000000000001');

SELECT has_function('public', 'student_create_interview_session', ARRAY['uuid', 'text', 'text'], 'Function student_create_interview_session exists');

-- Security Definition
SELECT function_privs_are('public', 'student_create_interview_session', ARRAY['uuid', 'text', 'text'], 'anon', ARRAY[]::text[], 'anon has no execute rights');
SELECT function_privs_are('public', 'student_create_interview_session', ARRAY['uuid', 'text', 'text'], 'public', ARRAY[]::text[], 'public has no execute rights');
SELECT function_privs_are('public', 'student_create_interview_session', ARRAY['uuid', 'text', 'text'], 'service_role', ARRAY[]::text[], 'service_role has no execute rights');
SELECT function_privs_are('public', 'student_create_interview_session', ARRAY['uuid', 'text', 'text'], 'authenticated', ARRAY['EXECUTE'], 'authenticated has execute rights');

-- Act as user 1
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Test creation
SELECT lives_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-1', repeat('a', 64)) $$,
  'Can create session successfully'
);

-- Replay
SELECT lives_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-1', repeat('a', 64)) $$,
  'Replay session successfully'
);

-- Check status
PREPARE check_res AS SELECT (public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-1', repeat('a', 64)))->>'response_status';
SELECT results_eq('check_res', ARRAY['201'], 'Replay returns 201 for creation (simulated 201 via JSON)');
DEALLOCATE check_res;

-- Conflict test: same key, different interview
SELECT throws_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000002'::uuid, 'idem-1', repeat('c', 64)) $$,
  'P0007',
  'IDEMPOTENCY_CONFLICT',
  'Cannot reuse idempotency key for different interview'
);


-- Switch to postgres role to inspect internal state and mutate fixtures
RESET ROLE;

-- Check session was created
SELECT is(
  (
    SELECT count(*)
    FROM public.interview_sessions
    WHERE interview_id =
      '00000000-0000-0000-0007-000000000001'
      AND user_id =
        '00000000-0000-0000-0000-000000000001'
  ),
  1::bigint,
  'Exactly one owned session created'
);

-- Check questions selected (avoids RLS hiding ready sessions)
SELECT is(
  (
    SELECT count(*)
    FROM public.interview_session_questions AS isq
    JOIN public.interview_sessions AS s
      ON s.id = isq.session_id
    WHERE s.interview_id =
      '00000000-0000-0000-0007-000000000001'::uuid
      AND s.user_id =
        '00000000-0000-0000-0000-000000000001'::uuid
  ),
  2::bigint,
  'Exactly two questions assigned to the owned session'
);

-- Check question selection doesn't use internal_data
SELECT is(
  (SELECT (taxonomy_snapshot->>'question_internal_data') IS NULL FROM public.interview_session_questions LIMIT 1),
  true,
  'No internal data in snapshot'
);

-- Insert processing idempotency fixture
INSERT INTO public.idempotency_records (
  user_id,
  operation,
  idempotency_key,
  request_hash,
  status,
  resource_type,
  resource_id,
  locked_until,
  expires_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'INTERVIEWS_CREATE_SESSION',
  'idem-3',
  repeat('c', 64),
  'processing',
  'interview_session',
  '00000000-0000-0000-0008-000000000001',
  now() + interval '60 seconds',
  now() + interval '24 hours'
);


-- Act as user 1 again
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001", "role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-3', repeat('c', 64)) $$,
  'P0006',
  'IDEMPOTENCY_IN_PROGRESS',
  'Throws in_progress if record status is in_progress'
);

-- Failed operations leave no session or audit
SELECT throws_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-fail', repeat('d', 64)) $$,
  'P0003',
  'RESOURCE_CONFLICT',
  'Fails because session is already active (ready) for this interview'
);


-- Act as user 2
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-2', repeat('b', 64)) $$,
  'P0002',
  'RESOURCE_NOT_FOUND',
  'Cannot create session for someone else''s interview'
);


-- Switch to postgres role to suspend user
RESET ROLE;
UPDATE public.users SET account_status = 'suspended' WHERE id = '00000000-0000-0000-0000-000000000002'::uuid;

-- Act as user 2 again
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002", "role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.student_create_interview_session('00000000-0000-0000-0007-000000000001'::uuid, 'idem-2', repeat('b', 64)) $$,
  'P0001',
  'FORBIDDEN_ACCESS',
  'Suspended user cannot create session'
);


-- Switch to postgres role for final assertions
RESET ROLE;

-- Audit log
SELECT is(
  (SELECT count(*) FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_CREATED'),
  1::bigint,
  'Audit log created exactly once (no duplicate on replay)'
);

SELECT is(
  (SELECT count(*) FROM public.interview_sessions WHERE id NOT IN (SELECT resource_id FROM public.audit_logs WHERE action = 'INTERVIEW_SESSION_CREATED' AND resource_type = 'interview_session')),
  0::bigint,
  'Failed operation left no session behind'
);

SELECT * FROM finish();
ROLLBACK;
