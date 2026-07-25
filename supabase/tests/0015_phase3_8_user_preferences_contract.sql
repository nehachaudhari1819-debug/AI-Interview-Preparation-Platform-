BEGIN;

SELECT plan(32);

-- 1. Check Table and Columns (8 tests)
SELECT has_table('public', 'user_preferences', 'public.user_preferences table exists');
SELECT has_pk('public', 'user_preferences', 'user_id primary key exists');
SELECT has_fk('public', 'user_preferences', 'foreign key exists');
SELECT has_column('public', 'user_preferences', 'locale', 'locale column exists');
SELECT has_column('public', 'user_preferences', 'time_zone', 'time_zone column exists');
SELECT has_column('public', 'user_preferences', 'practice_reminders_enabled', 'practice_reminders_enabled exists');
SELECT has_column('public', 'user_preferences', 'weekly_progress_summary_enabled', 'weekly_progress_summary_enabled exists');
SELECT has_column('public', 'user_preferences', 'created_at', 'created_at exists');

-- Check Defaults (2 tests)
SELECT col_default_is('public', 'user_preferences', 'locale', 'en', 'locale default is en');
SELECT col_default_is('public', 'user_preferences', 'practice_reminders_enabled', 'false', 'practice_reminders_enabled default is false');

-- Setup testing roles and users
DO $$
DECLARE
    v_user1_id uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
    v_user2_id uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid;
    v_user3_id uuid := 'cccccccc-3333-3333-3333-cccccccccccc'::uuid;
    v_user_suspended uuid := 'dddddddd-4444-4444-4444-dddddddddddd'::uuid;
BEGIN
    DELETE FROM auth.users WHERE id IN (v_user1_id, v_user2_id, v_user3_id, v_user_suspended);

    -- This will implicitly trigger handle_new_auth_user -> public.users -> provision_user_preferences
    INSERT INTO auth.users (id, email) VALUES (v_user1_id, 'test_a_pref@example.com');
    INSERT INTO auth.users (id, email) VALUES (v_user2_id, 'test_b_pref@example.com');
    INSERT INTO auth.users (id, email) VALUES (v_user_suspended, 'test_susp_pref@example.com');
    
    UPDATE public.users SET account_status = 'active' WHERE id IN (v_user1_id, v_user2_id);
    UPDATE public.users SET account_status = 'suspended' WHERE id = v_user_suspended;
END $$;

-- 21. Future user automatically provisioned
SELECT is(
    (SELECT count(*) FROM public.user_preferences WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid)::integer,
    1,
    'Future user automatically provisioned'
);

-- 22. Duplicate preference row prevented (Primary Key constraint violation)
SELECT throws_ok(
    'INSERT INTO public.user_preferences (user_id) VALUES (''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid)',
    '23505', -- unique_violation
    NULL,
    'Duplicate preference row prevented'
);

-- Check RLS enabled
SELECT is(
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_preferences'),
    true,
    'RLS is enabled on user_preferences'
);

-- Test Anon Access
SET LOCAL ROLE anon;
SELECT throws_ok(
    'SELECT count(*)::integer FROM public.user_preferences',
    '42501',
    NULL,
    'anonymous has no select access'
);
SELECT throws_ok(
    'INSERT INTO public.user_preferences (user_id) VALUES (''cccccccc-3333-3333-3333-cccccccccccc''::uuid)',
    '42501', -- insufficient_privilege
    NULL,
    'anonymous has no insert access'
);
RESET ROLE;

-- Test Authenticated Non-Owner Access
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'), true);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
    'INSERT INTO public.user_preferences (user_id) VALUES (''cccccccc-3333-3333-3333-cccccccccccc''::uuid)',
    '42501',
    NULL,
    'authenticated cannot insert'
);

SELECT throws_ok(
    'DELETE FROM public.user_preferences WHERE user_id = ''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid',
    '42501',
    NULL,
    'authenticated cannot delete'
);

SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid),
    1,
    'owner can select'
);

SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid),
    0,
    'cross-user select is blocked'
);

UPDATE public.user_preferences SET locale = 'en-US' WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
SELECT is(
    (SELECT locale FROM public.user_preferences WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid),
    'en-US'::varchar,
    'owner can update'
);

UPDATE public.user_preferences SET locale = 'en-GB' WHERE user_id = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid;
RESET ROLE;
SELECT is(
    (SELECT locale FROM public.user_preferences WHERE user_id = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid),
    'en'::varchar, -- remains default
    'cross-user update is blocked'
);

-- Test Suspended User
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'dddddddd-4444-4444-4444-dddddddddddd'), true);
SET LOCAL ROLE authenticated;

SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid),
    0,
    'suspended user is blocked from select'
);

UPDATE public.user_preferences SET locale = 'fr' WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid;
RESET ROLE;
SELECT is(
    (SELECT locale FROM public.user_preferences WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid),
    'en'::varchar,
    'suspended user is blocked from update'
);

-- Deletion state setup
UPDATE public.users SET account_status = 'deletion_pending' WHERE id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid;

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'dddddddd-4444-4444-4444-dddddddddddd'), true);
SET LOCAL ROLE authenticated;
SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid),
    0,
    'deletion-pending user is blocked from select'
);
RESET ROLE;

UPDATE public.users SET account_status = 'deleted' WHERE id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid;
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'dddddddd-4444-4444-4444-dddddddddddd'), true);
SET LOCAL ROLE authenticated;
SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid),
    0,
    'deleted user is blocked from select'
);
RESET ROLE;

-- Verify preferences row is preserved after soft deletion
SELECT is(
    (SELECT count(*)::integer FROM public.user_preferences WHERE user_id = 'dddddddd-4444-4444-4444-dddddddddddd'::uuid),
    1,
    'account soft deletion preserves preference row'
);

-- Audit Tests
-- Note: We cannot DELETE FROM public.audit_logs because they are immutable.
-- The previous test (line 105) updated the locale from 'en' to 'en-US', generating 1 audit log.

SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'), true);
SET LOCAL ROLE authenticated;

-- No-op update
UPDATE public.user_preferences SET locale = 'en-US' WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SELECT is(
    (SELECT count(*)::integer FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'USER_PREFERENCES_UPDATED'),
    1,
    'no-op update creates no audit (count remains 1)'
);

-- Actual update
SET LOCAL ROLE authenticated;
UPDATE public.user_preferences SET locale = 'fr-FR', time_zone = 'Europe/Paris' WHERE user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SELECT is(
    (SELECT count(*)::integer FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'USER_PREFERENCES_UPDATED'),
    2,
    'multiple changed fields create one audit (count becomes 2)'
);

SELECT is(
    (SELECT count(*)::integer FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'USER_PREFERENCES_UPDATED' AND metadata->>'changedFields' = '["locale", "timeZone"]'),
    1,
    'audit metadata contains sorted field names only and no values'
);

-- Triggers
SELECT is(
    (SELECT proconfig FROM pg_proc WHERE proname = 'audit_user_preferences_update'),
    ARRAY['search_path=""'],
    'audit_user_preferences_update trigger function search_path is empty'
);

SELECT throws_ok(
    'SELECT private.audit_user_preferences_update()',
    '0A000',
    NULL,
    'trigger functions are not publicly executable'
);

-- Audit table boundaries
SET LOCAL ROLE authenticated;
SELECT throws_ok(
    'DELETE FROM public.audit_logs WHERE actor_user_id = ''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid',
    '42501',
    NULL,
    'audit table remains client-inaccessible'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
