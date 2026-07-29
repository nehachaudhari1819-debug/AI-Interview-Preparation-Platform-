BEGIN;

SELECT plan(172);

-- Setup: Create test users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
('00000000-0000-0000-0000-000000000001', 'test1@example.com', '{"fullName":"Test User One"}'::jsonb),
('00000000-0000-0000-0000-000000000002', 'test2@example.com', '{"fullName":"Test User Two"}'::jsonb),
('00000000-0000-0000-0000-000000000003', 'test3@example.com', '{"fullName":"Test User Three"}'::jsonb),
('00000000-0000-0000-0000-000000000004', 'test4@example.com', '{"fullName":"Test User Four"}'::jsonb),
('00000000-0000-0000-0000-000000000005', 'test5@example.com', '{"fullName":"Test User Five"}'::jsonb);

UPDATE public.users SET role = 'student', account_status = 'active'
WHERE id IN ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

UPDATE public.users SET role = 'student', account_status = 'deleted', deleted_at = now()
WHERE id = '00000000-0000-0000-0000-000000000003';

UPDATE public.users SET role = 'student', account_status = 'suspended'
WHERE id = '00000000-0000-0000-0000-000000000004';

DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000005';

-- Taxonomy test data
INSERT INTO public.question_interview_types (id, name, slug) VALUES ('00000000-0000-0000-0001-000000000001', 'Type 1', 'type-1');
INSERT INTO public.question_difficulties (id, name, slug) VALUES ('00000000-0000-0000-0002-000000000001', 'Diff 1', 'diff-1');
INSERT INTO public.question_skills (id, name, slug) VALUES ('00000000-0000-0000-0003-000000000001', 'Skill 1', 'skill-1');
INSERT INTO public.question_topics (id, name, slug) VALUES ('00000000-0000-0000-0004-000000000001', 'Topic 1', 'topic-1');
INSERT INTO public.question_categories (id, name, slug) VALUES ('00000000-0000-0000-0005-000000000001', 'Cat 1', 'cat-1');

-- Question test data
INSERT INTO public.questions (id, created_by, category_id, interview_type_id, difficulty_id, question_text, status)
VALUES
('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Test interview question one', 'draft'),
('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 'Test interview question two', 'draft');

UPDATE public.questions SET status = 'published' WHERE id IN ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0006-000000000002');

INSERT INTO public.question_internal_data (question_id, reference_answer, evaluation_guidance)
VALUES ('00000000-0000-0000-0006-000000000001', 'Ref ans', '{"guide": "test"}');

-- Create interview and mappings for tests
PREPARE insert_valid_interview AS
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', 'Valid', 'Valid', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 5);
EXECUTE insert_valid_interview;

INSERT INTO public.interview_skill_mappings (interview_id, skill_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0003-000000000001');
INSERT INTO public.interview_topic_mappings (interview_id, topic_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0004-000000000001');

-------------------------------------------------------------------------------
-- 1. Enum validation (2 assertions)
-------------------------------------------------------------------------------
SELECT has_enum('public', 'interview_session_status_enum', 'Enum interview_session_status_enum should exist');
SELECT enum_has_labels('public', 'interview_session_status_enum', ARRAY['ready', 'in_progress', 'paused', 'completed'], 'Enum has correct labels');

-------------------------------------------------------------------------------
-- 2. Schema existence & structure (50 assertions)
-------------------------------------------------------------------------------
SELECT has_table('public', 'interviews', 'Table public.interviews should exist');
SELECT has_table('public', 'interview_sessions', 'Table public.interview_sessions should exist');
SELECT has_table('public', 'interview_skill_mappings', 'Table public.interview_skill_mappings should exist');
SELECT has_table('public', 'interview_topic_mappings', 'Table public.interview_topic_mappings should exist');
SELECT has_table('public', 'interview_session_questions', 'Table public.interview_session_questions should exist');

SELECT has_column('public', 'interviews', 'id', 'interviews has id');
SELECT col_type_is('public', 'interviews', 'id', 'uuid', 'interviews.id is uuid');
SELECT col_is_pk('public', 'interviews', 'id', 'interviews.id is the primary key');
SELECT has_column('public', 'interviews', 'user_id', 'interviews has user_id');
SELECT col_not_null('public', 'interviews', 'user_id', 'interviews.user_id is required');
SELECT has_column('public', 'interviews', 'title', 'interviews has title');
SELECT col_not_null('public', 'interviews', 'title', 'interviews.title is required');
SELECT col_has_default('public', 'interviews', 'created_at', 'interviews.created_at has a default');
SELECT col_has_default('public', 'interviews', 'updated_at', 'interviews.updated_at has a default');

SELECT has_column('public', 'interview_skill_mappings', 'interview_id', 'interview_skill_mappings has interview_id');
SELECT has_column('public', 'interview_skill_mappings', 'skill_id', 'interview_skill_mappings has skill_id');
SELECT col_is_pk('public', 'interview_skill_mappings', ARRAY['interview_id', 'skill_id']::name[], 'interview_skill_mappings has the expected composite primary key');

SELECT has_column('public', 'interview_topic_mappings', 'interview_id', 'interview_topic_mappings has interview_id');
SELECT has_column('public', 'interview_topic_mappings', 'topic_id', 'interview_topic_mappings has topic_id');
SELECT col_is_pk('public', 'interview_topic_mappings', ARRAY['interview_id', 'topic_id']::name[], 'interview_topic_mappings has the expected composite primary key');

SELECT has_column('public', 'interview_sessions', 'id', 'interview_sessions has id');
SELECT col_is_pk('public', 'interview_sessions', 'id', 'interview_sessions.id is the primary key');
SELECT has_column('public', 'interview_sessions', 'interview_id', 'interview_sessions has interview_id');
SELECT col_not_null('public', 'interview_sessions', 'interview_id', 'interview_sessions.interview_id is required');
SELECT has_column('public', 'interview_sessions', 'user_id', 'interview_sessions has user_id');
SELECT col_not_null('public', 'interview_sessions', 'user_id', 'interview_sessions.user_id is required');
SELECT has_column('public', 'interview_sessions', 'status', 'interview_sessions has status');
SELECT col_has_default('public', 'interview_sessions', 'status', 'interview_sessions.status has a default');
SELECT col_default_is('public', 'interview_sessions', 'status', 'ready'::public.interview_session_status_enum, 'interview_sessions.status default is ready');
SELECT has_column('public', 'interview_sessions', 'config_snapshot', 'interview_sessions has config_snapshot');
SELECT col_type_is('public', 'interview_sessions', 'config_snapshot', 'jsonb', 'interview_sessions.config_snapshot is jsonb');
SELECT has_column('public', 'interview_sessions', 'config_snapshot_version', 'interview_sessions has config_snapshot_version');
SELECT col_type_is('public', 'interview_sessions', 'config_snapshot_version', 'integer', 'interview_sessions.config_snapshot_version is integer');
SELECT col_default_is('public', 'interview_sessions', 'config_snapshot_version', 1::integer, 'interview_sessions.config_snapshot_version default is 1');
SELECT has_column('public', 'interview_sessions', 'total_paused_seconds', 'interview_sessions has total_paused_seconds');
SELECT col_has_default('public', 'interview_sessions', 'total_paused_seconds', 'interview_sessions.total_paused_seconds has a default');
SELECT col_default_is('public', 'interview_sessions', 'total_paused_seconds', 0::integer, 'interview_sessions.total_paused_seconds default is 0');

SELECT has_column('public', 'interview_session_questions', 'id', 'interview_session_questions has id');
SELECT col_is_pk('public', 'interview_session_questions', 'id', 'interview_session_questions.id is the primary key');
SELECT has_column('public', 'interview_session_questions', 'display_order', 'interview_session_questions has display_order');
SELECT col_not_null('public', 'interview_session_questions', 'display_order', 'interview_session_questions.display_order is required');
SELECT col_is_unique('public', 'interview_session_questions', ARRAY['session_id', 'display_order']::name[], 'session and display order are unique');
SELECT col_is_unique('public', 'interview_session_questions', ARRAY['session_id', 'question_id']::name[], 'session and question are unique');
SELECT has_column('public', 'interview_session_questions', 'question_text_snapshot', 'interview_session_questions has question_text_snapshot');
SELECT col_type_is('public', 'interview_session_questions', 'question_text_snapshot', 'text', 'interview_session_questions.question_text_snapshot is text');
SELECT has_column('public', 'interview_session_questions', 'taxonomy_snapshot', 'interview_session_questions has taxonomy_snapshot');
SELECT col_type_is('public', 'interview_session_questions', 'taxonomy_snapshot', 'jsonb', 'interview_session_questions.taxonomy_snapshot is jsonb');
SELECT has_column('public', 'interview_session_questions', 'question_snapshot_version', 'interview_session_questions has question_snapshot_version');
SELECT col_type_is('public', 'interview_session_questions', 'question_snapshot_version', 'integer', 'interview_session_questions.question_snapshot_version is integer');
SELECT col_default_is('public', 'interview_session_questions', 'question_snapshot_version', 1::integer, 'interview_session_questions.question_snapshot_version default is 1');

-------------------------------------------------------------------------------
-- 3. Foreign Keys (16 assertions)
-------------------------------------------------------------------------------
SELECT fk_ok('public', 'interviews', 'user_id', 'public', 'users', 'id', 'interviews.user_id fk');
SELECT fk_ok('public', 'interview_sessions', 'user_id', 'public', 'users', 'id', 'interview_sessions.user_id fk');
SELECT fk_ok('public', 'interview_sessions', ARRAY['interview_id', 'user_id']::name[], 'public', 'interviews', ARRAY['id', 'user_id']::name[], 'session owner matches interview owner');
SELECT fk_ok('public', 'interview_session_questions', 'session_id', 'public', 'interview_sessions', 'id', 'interview_session_questions.session_id fk');
SELECT fk_ok('public', 'interview_session_questions', 'question_id', 'public', 'questions', 'id', 'interview_session_questions.question_id fk');
SELECT fk_ok('public', 'interview_skill_mappings', 'interview_id', 'public', 'interviews', 'id', 'interview_skill_mappings.interview_id fk');
SELECT fk_ok('public', 'interview_topic_mappings', 'interview_id', 'public', 'interviews', 'id', 'interview_topic_mappings.interview_id fk');

-- 3.1 Composite Ownership Behavior
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot) VALUES ('00000000-0000-0000-0010-000000000001', '00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000002', '{}') $$,
    '23503', NULL, 'Rejects session creation for a user that does not own the parent interview'
);

-- 3.2 ON DELETE RESTRICT Behavior
-- Insert a temporary session and question to test delete restricts
INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot, status, started_at, completed_at) VALUES ('00000000-0000-0000-0010-000000000002', '00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'completed', now(), now());
INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0010-000000000002', '00000000-0000-0000-0006-000000000001', 1, 'text', '{}');

SELECT throws_ok(
    $$ DELETE FROM public.interviews WHERE id = '00000000-0000-0000-0007-000000000001' $$,
    '23503', NULL, 'Restricts deletion of interviews with active sessions'
);
SELECT throws_ok(
    $$ DELETE FROM public.questions WHERE id = '00000000-0000-0000-0006-000000000001' $$,
    '23503', NULL, 'Restricts deletion of questions linked to session questions'
);
SELECT throws_ok(
    $$ DELETE FROM public.question_skills WHERE id = '00000000-0000-0000-0003-000000000001' $$,
    '23503', NULL, 'Restricts deletion of mapped skills'
);
SELECT throws_ok(
    $$ DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001' $$,
    '23503', NULL, 'Restricts deletion of user with interviews/sessions'
);
SELECT throws_ok(
    $$ DELETE FROM public.question_interview_types WHERE id = '00000000-0000-0000-0001-000000000001' $$,
    '23503', NULL, 'Restricts deletion of in-use interview type'
);
SELECT throws_ok(
    $$ DELETE FROM public.question_difficulties WHERE id = '00000000-0000-0000-0002-000000000001' $$,
    '23503', NULL, 'Restricts deletion of in-use difficulty'
);
SELECT throws_ok(
    $$ DELETE FROM public.question_topics WHERE id = '00000000-0000-0000-0004-000000000001' $$,
    '23503', NULL, 'Restricts deletion of mapped topics'
);
SELECT throws_ok(
    $$ DELETE FROM public.interview_sessions WHERE id = '00000000-0000-0000-0010-000000000002' $$,
    '23503', NULL, 'Restricts deletion of session with questions'
);

-------------------------------------------------------------------------------
-- 4. Constraints & Behavior Tests (11 assertions)
-------------------------------------------------------------------------------
SELECT throws_ok(
    $$ INSERT INTO public.interviews (user_id, title, target_role, interview_type_id, difficulty_id, question_count) VALUES ('00000000-0000-0000-0000-000000000001', '  ', 'Valid', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 5) $$,
    '23514', NULL, 'interviews.title cannot be empty or just whitespace'
);
SELECT throws_ok(
    $$ INSERT INTO public.interviews (user_id, title, target_role, interview_type_id, difficulty_id, question_count) VALUES ('00000000-0000-0000-0000-000000000001', 'Valid', '  ', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 5) $$,
    '23514', NULL, 'interviews.target_role cannot be empty or just whitespace'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '"string"') $$,
    '23514', NULL, 'interview_sessions.config_snapshot must be an object'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, config_snapshot_version) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 0) $$,
    '23514', NULL, 'interview_sessions.config_snapshot_version must be > 0'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot, question_snapshot_version) VALUES ('00000000-0000-0000-0010-000000000002', '00000000-0000-0000-0006-000000000002', 3, 'text', '{}', 0) $$,
    '23514', NULL, 'Rejects question snapshot version <= 0'
);

SELECT lives_ok(
    $$
    INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot, status, last_transition_at, created_at, updated_at)
    VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'ready', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00')
    $$,
    'Can insert ready session'
);

SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status, started_at) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'ready', now()) $$,
    '23514', NULL, 'Ready session cannot have started_at'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'in_progress') $$,
    '23514', NULL, 'In progress session must have started_at'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status, total_paused_seconds) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'ready', 5) $$,
    '23514', NULL, 'Ready session must have 0 paused seconds'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'ready') $$,
    '23505', NULL, 'Cannot have more than one unfinished session per interview'
);

SELECT lives_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status, started_at, completed_at) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'completed', now(), now());
       INSERT INTO public.interview_sessions (interview_id, user_id, config_snapshot, status, started_at, completed_at) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'completed', now(), now()); $$,
    'Can have multiple completed sessions'
);

-------------------------------------------------------------------------------
-- 5. Session Question Constraints (5 assertions)
-------------------------------------------------------------------------------
SELECT lives_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000001', 1, 'text', '{}') $$,
    'Can insert session question'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000002', 1, 'text2', '{}') $$,
    '23505', NULL, 'Rejects duplicate display order'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000001', 2, 'text2', '{}') $$,
    '23505', NULL, 'Rejects duplicate question id'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000001', 2, '   ', '{}') $$,
    '23514', NULL, 'Rejects empty question text snapshot'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000001', 2, 'text', '"string"') $$,
    '23514', NULL, 'Rejects non-object taxonomy snapshot'
);

-------------------------------------------------------------------------------
-- 6. Trigger Constraints (15 assertions)
-------------------------------------------------------------------------------
SELECT has_trigger('public', 'interview_sessions', 'enforce_interview_session_immutable', 'interview_sessions has immutable trigger');
SELECT has_trigger('public', 'interview_session_questions', 'enforce_interview_session_question_immutable_update', 'interview_session_questions has immutable trigger for update');
SELECT has_trigger('public', 'interview_session_questions', 'enforce_interview_session_question_immutable_delete', 'interview_session_questions has immutable trigger for delete');
SELECT has_trigger('public', 'interviews', 'set_interviews_updated_at', 'interviews has updated_at trigger');
SELECT has_trigger('public', 'interview_sessions', 'set_interview_sessions_updated_at', 'interview_sessions has updated_at trigger');

-- Immutable session fields
PREPARE insert_valid_interview_2 AS
INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count)
VALUES ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0000-000000000001', 'Valid 2', 'Valid 2', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 5);
EXECUTE insert_valid_interview_2;

SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET id = '00000000-0000-0000-0010-000000000003' WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session id is immutable', 'Trigger prevents changing id'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET interview_id = '00000000-0000-0000-0007-000000000002' WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session interview_id is immutable', 'Trigger prevents changing interview_id'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET user_id = '00000000-0000-0000-0000-000000000002' WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session user_id is immutable', 'Trigger prevents changing user_id'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET created_at = now() WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session created_at is immutable', 'Trigger prevents changing created_at'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET config_snapshot = '{"changed":true}' WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session config_snapshot is immutable', 'Trigger prevents changing config_snapshot'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET config_snapshot_version = 2 WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    'P0001', 'Session config_snapshot_version is immutable', 'Trigger prevents changing config_snapshot_version'
);

SELECT throws_ok(
    $$ UPDATE public.interview_session_questions SET display_order = 2 WHERE session_id = '00000000-0000-0000-0008-000000000001' $$,
    'Interview session questions are strictly immutable and cannot be updated or deleted.', 'Trigger prevents updating session questions'
);
SELECT throws_ok(
    $$ DELETE FROM public.interview_session_questions WHERE session_id = '00000000-0000-0000-0008-000000000001' $$,
    'Interview session questions are strictly immutable and cannot be updated or deleted.', 'Trigger prevents deleting session questions'
);

CREATE TEMP TABLE session_timestamp_evidence (
    before_noop timestamptz, after_noop timestamptz, after_change timestamptz
) ON COMMIT DROP;

INSERT INTO session_timestamp_evidence (before_noop) SELECT updated_at FROM public.interview_sessions WHERE id = '00000000-0000-0000-0008-000000000001';
UPDATE public.interview_sessions SET status = status WHERE id = '00000000-0000-0000-0008-000000000001';
UPDATE session_timestamp_evidence SET after_noop = (SELECT updated_at FROM public.interview_sessions WHERE id = '00000000-0000-0000-0008-000000000001');

SELECT is((SELECT after_noop FROM session_timestamp_evidence), (SELECT before_noop FROM session_timestamp_evidence), 'True no-op preserves updated_at');

UPDATE public.interview_sessions SET status = 'in_progress', started_at = now(), last_transition_at = now() WHERE id = '00000000-0000-0000-0008-000000000001';
UPDATE session_timestamp_evidence SET after_change = (SELECT updated_at FROM public.interview_sessions WHERE id = '00000000-0000-0000-0008-000000000001');

SELECT cmp_ok((SELECT after_change FROM session_timestamp_evidence), '>', (SELECT after_noop FROM session_timestamp_evidence), 'Real update advances updated_at');

-------------------------------------------------------------------------------
-- 7. Indexes (6 assertions)
-------------------------------------------------------------------------------
SELECT has_index('public', 'interviews', 'idx_interviews_user_created_at', 'interviews has user/created index');
SELECT has_index('public', 'interview_skill_mappings', 'idx_interview_skill_mappings_skill_id', 'mappings has skill index');
SELECT has_index('public', 'interview_topic_mappings', 'idx_interview_topic_mappings_topic_id', 'mappings has topic index');
SELECT has_index('public', 'interview_sessions', 'idx_interview_sessions_user_created_at', 'sessions has user/created index');
SELECT has_index('public', 'interview_sessions', 'idx_interview_sessions_interview_created_at', 'sessions has interview/created index');
SELECT has_index('public', 'interview_sessions', 'idx_interview_sessions_active_session', 'sessions has partial active unique index');

-------------------------------------------------------------------------------
-- 8. Table Privileges (23 assertions)
-------------------------------------------------------------------------------
SELECT table_privs_are('public', 'interviews', 'authenticated', ARRAY['SELECT']);
SELECT table_privs_are('public', 'interview_skill_mappings', 'authenticated', ARRAY['SELECT']);
SELECT table_privs_are('public', 'interview_topic_mappings', 'authenticated', ARRAY['SELECT']);
SELECT table_privs_are('public', 'interview_sessions', 'authenticated', ARRAY['SELECT']);
SELECT table_privs_are('public', 'interview_session_questions', 'authenticated', ARRAY['SELECT']);

SELECT table_privs_are('public', 'interviews', 'anon', ARRAY[]::text[]);
SELECT table_privs_are('public', 'interview_skill_mappings', 'anon', ARRAY[]::text[]);
SELECT table_privs_are('public', 'interview_topic_mappings', 'anon', ARRAY[]::text[]);
SELECT table_privs_are('public', 'interview_sessions', 'anon', ARRAY[]::text[]);
SELECT table_privs_are('public', 'interview_session_questions', 'anon', ARRAY[]::text[]);

SELECT table_privs_are('public', 'interviews', 'service_role', ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
SELECT table_privs_are('public', 'interview_skill_mappings', 'service_role', ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
SELECT table_privs_are('public', 'interview_topic_mappings', 'service_role', ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
SELECT table_privs_are('public', 'interview_sessions', 'service_role', ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);
SELECT table_privs_are('public', 'interview_session_questions', 'service_role', ARRAY['INSERT', 'SELECT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']);

SET SESSION ROLE authenticated;
SELECT throws_ok(
    $$ INSERT INTO public.interviews (id, user_id, title, target_role, interview_type_id, difficulty_id, question_count) VALUES ('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0000-000000000001', 'Direct', 'Direct', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0002-000000000001', 5) $$,
    '42501', NULL, 'Authenticated users cannot directly insert into interviews'
);
SELECT throws_ok(
    $$ UPDATE public.interviews SET title = 'Direct Update' WHERE id = '00000000-0000-0000-0007-000000000001' $$,
    '42501', NULL, 'Authenticated users cannot directly update interviews'
);
SELECT throws_ok(
    $$ DELETE FROM public.interviews WHERE id = '00000000-0000-0000-0007-000000000001' $$,
    '42501', NULL, 'Authenticated users cannot directly delete interviews'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_sessions (interview_id, user_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001') $$,
    '42501', NULL, 'Authenticated users cannot directly insert into interview_sessions'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_session_questions (session_id, question_id, display_order) VALUES ('00000000-0000-0000-0008-000000000001', '00000000-0000-0000-0006-000000000001', 5) $$,
    '42501', NULL, 'Authenticated users cannot directly insert into interview_session_questions'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_skill_mappings (interview_id, skill_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0003-000000000001') $$,
    '42501', NULL, 'Authenticated users cannot directly insert into interview_skill_mappings'
);
SELECT throws_ok(
    $$ INSERT INTO public.interview_topic_mappings (interview_id, topic_id) VALUES ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0004-000000000001') $$,
    '42501', NULL, 'Authenticated users cannot directly insert into interview_topic_mappings'
);
SELECT throws_ok(
    $$ UPDATE public.interview_sessions SET status = 'completed' WHERE id = '00000000-0000-0000-0008-000000000001' $$,
    '42501', NULL, 'Authenticated users cannot directly update interview_sessions'
);
RESET ROLE;

-------------------------------------------------------------------------------
-- 9. RLS Policies (10 assertions)
-------------------------------------------------------------------------------
SELECT policies_are('public', 'interviews', ARRAY['interviews_student_read']);
SELECT policies_are('public', 'interview_skill_mappings', ARRAY['interview_skill_mappings_student_read']);
SELECT policies_are('public', 'interview_topic_mappings', ARRAY['interview_topic_mappings_student_read']);
SELECT policies_are('public', 'interview_sessions', ARRAY['interview_sessions_student_read']);
SELECT policies_are('public', 'interview_session_questions', ARRAY['interview_session_questions_student_read']);

SELECT policy_roles_are('public', 'interviews', 'interviews_student_read', ARRAY['authenticated']);
SELECT policy_roles_are('public', 'interview_sessions', 'interview_sessions_student_read', ARRAY['authenticated']);
SELECT policy_roles_are('public', 'interview_session_questions', 'interview_session_questions_student_read', ARRAY['authenticated']);
SELECT policy_roles_are('public', 'interview_skill_mappings', 'interview_skill_mappings_student_read', ARRAY['authenticated']);
SELECT policy_roles_are('public', 'interview_topic_mappings', 'interview_topic_mappings_student_read', ARRAY['authenticated']);

-------------------------------------------------------------------------------
-- 10. Function Privileges (6 assertions)
-------------------------------------------------------------------------------
SELECT function_privs_are('private', 'enforce_interview_session_immutable_fields', ARRAY[]::text[], 'public', ARRAY[]::text[]);
SELECT function_privs_are('private', 'prevent_interview_session_question_mutation', ARRAY[]::text[], 'public', ARRAY[]::text[]);
SELECT function_privs_are('private', 'enforce_interview_session_immutable_fields', ARRAY[]::text[], 'anon', ARRAY[]::text[]);
SELECT function_privs_are('private', 'prevent_interview_session_question_mutation', ARRAY[]::text[], 'anon', ARRAY[]::text[]);
SELECT function_privs_are('private', 'enforce_interview_session_immutable_fields', ARRAY[]::text[], 'authenticated', ARRAY[]::text[]);
SELECT function_privs_are('private', 'prevent_interview_session_question_mutation', ARRAY[]::text[], 'authenticated', ARRAY[]::text[]);

-------------------------------------------------------------------------------
-- 11. End-to-End RLS Testing (28 assertions)
-------------------------------------------------------------------------------
-- Insert paused and completed sessions/questions for User 1 testing
INSERT INTO public.interviews (
    id,
    user_id,
    title,
    target_role,
    interview_type_id,
    difficulty_id,
    question_count
)
VALUES (
    '00000000-0000-0000-0007-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Paused Session Interview',
    'Valid',
    '00000000-0000-0000-0001-000000000001',
    '00000000-0000-0000-0002-000000000001',
    5
);

INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot, status, started_at, paused_at, last_transition_at)
VALUES ('00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0000-000000000001', '{}', 'paused', now(), now(), now());
INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES ('00000000-0000-0000-0008-000000000002', '00000000-0000-0000-0006-000000000001', 1, 'text', '{}');

INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot, status, started_at, completed_at, last_transition_at)
VALUES ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0000-000000000001', '{}', 'completed', now(), now(), now());
INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES ('00000000-0000-0000-0008-000000000003', '00000000-0000-0000-0006-000000000001', 1, 'text', '{}');

-- Test as User 1 (Active Owner)
SET SESSION ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

SELECT results_eq(
    'SELECT id FROM public.interviews ORDER BY id',
    ARRAY[
        '00000000-0000-0000-0007-000000000001'::uuid,
        '00000000-0000-0000-0007-000000000002'::uuid,
        '00000000-0000-0000-0007-000000000003'::uuid
    ],
    'User 1 can see all and only their own interviews'
);
SELECT results_eq(
    'SELECT id FROM public.interview_sessions WHERE status = ''in_progress''',
    ARRAY['00000000-0000-0000-0008-000000000001'::uuid],
    'User 1 can see their own in-progress session'
);
SELECT results_eq(
    'SELECT id FROM public.interview_sessions WHERE status = ''paused''',
    ARRAY['00000000-0000-0000-0008-000000000002'::uuid],
    'User 1 can see their own paused session'
);
SELECT results_eq(
    $$
    SELECT id
    FROM public.interview_sessions
    WHERE id = '00000000-0000-0000-0008-000000000003'
      AND status = 'completed'
    $$,
    ARRAY[
        '00000000-0000-0000-0008-000000000003'::uuid
    ],
    'User 1 can see their own completed session'
);
SELECT results_eq(
    'SELECT session_id FROM public.interview_session_questions ORDER BY session_id',
    ARRAY['00000000-0000-0000-0008-000000000001'::uuid, '00000000-0000-0000-0008-000000000002'::uuid, '00000000-0000-0000-0008-000000000003'::uuid, '00000000-0000-0000-0010-000000000002'::uuid],
    'User 1 can see questions for their started/paused/completed sessions'
);
SELECT results_eq(
    'SELECT skill_id FROM public.interview_skill_mappings',
    ARRAY['00000000-0000-0000-0003-000000000001'::uuid],
    'User 1 can see their own skill mappings'
);
SELECT results_eq(
    'SELECT topic_id FROM public.interview_topic_mappings',
    ARRAY['00000000-0000-0000-0004-000000000001'::uuid],
    'User 1 can see their own topic mappings'
);

-- Test as User 2 (Active, Non-Owner)
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT is_empty('SELECT id FROM public.interviews', 'User 2 cannot see User 1 interviews');
SELECT is_empty('SELECT id FROM public.interview_sessions', 'User 2 cannot see User 1 sessions');
SELECT is_empty('SELECT session_id FROM public.interview_session_questions', 'User 2 cannot see User 1 questions');
SELECT is_empty('SELECT skill_id FROM public.interview_skill_mappings', 'User 2 cannot see User 1 skill mappings');
SELECT is_empty('SELECT topic_id FROM public.interview_topic_mappings', 'User 2 cannot see User 1 topic mappings');

-- Test as User 3 (Deleted Account)
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT is_empty('SELECT id FROM public.interviews', 'Deleted user cannot see interviews');
SELECT is_empty('SELECT id FROM public.interview_sessions', 'Deleted user cannot see sessions');
SELECT is_empty('SELECT session_id FROM public.interview_session_questions', 'Deleted user cannot see questions');
SELECT is_empty('SELECT skill_id FROM public.interview_skill_mappings', 'Deleted user cannot see skill mappings');
SELECT is_empty('SELECT topic_id FROM public.interview_topic_mappings', 'Deleted user cannot see topic mappings');

-- Test as User 4 (Suspended Account)
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT is_empty('SELECT id FROM public.interviews', 'Suspended user cannot see interviews');
SELECT is_empty('SELECT id FROM public.interview_sessions', 'Suspended user cannot see sessions');
SELECT is_empty('SELECT session_id FROM public.interview_session_questions', 'Suspended user cannot see questions');
SELECT is_empty('SELECT skill_id FROM public.interview_skill_mappings', 'Suspended user cannot see skill mappings');
SELECT is_empty('SELECT topic_id FROM public.interview_topic_mappings', 'Suspended user cannot see topic mappings');

-- Test as User 5 (Missing Profile Account)
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
SELECT is_empty('SELECT id FROM public.interviews', 'Missing profile user cannot see interviews');
SELECT is_empty('SELECT id FROM public.interview_sessions', 'Missing profile user cannot see sessions');
SELECT is_empty('SELECT session_id FROM public.interview_session_questions', 'Missing profile user cannot see questions');
SELECT is_empty('SELECT skill_id FROM public.interview_skill_mappings', 'Missing profile user cannot see skill mappings');
SELECT is_empty('SELECT topic_id FROM public.interview_topic_mappings', 'Missing profile user cannot see topic mappings');

-- Test Question Masking for Ready Sessions
RESET ROLE;
INSERT INTO public.interview_sessions (id, interview_id, user_id, config_snapshot, status)
VALUES ('00000000-0000-0000-0009-000000000001', '00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0000-000000000001', '{}', 'ready');
INSERT INTO public.interview_session_questions (session_id, question_id, display_order, question_text_snapshot, taxonomy_snapshot)
VALUES ('00000000-0000-0000-0009-000000000001', '00000000-0000-0000-0006-000000000001', 1, 'text', '{}');

SET SESSION ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

SELECT is_empty(
    'SELECT session_id FROM public.interview_session_questions WHERE session_id = ''00000000-0000-0000-0009-000000000001''',
    'User 1 cannot see questions for their READY session'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
