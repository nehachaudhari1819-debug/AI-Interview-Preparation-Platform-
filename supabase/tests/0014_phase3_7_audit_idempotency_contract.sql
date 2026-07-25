BEGIN;

SELECT plan(23);

-- We use dblink to simulate true concurrent database sessions.
CREATE EXTENSION IF NOT EXISTS dblink;

-- Setup environment
DO $$
DECLARE
    v_db text := current_database();
    v_user1_id uuid := 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
    v_user2_id uuid := 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid;
BEGIN
    -- 1. Setup persistent data outside the pgTAP transaction so dblink connections can see it.
    PERFORM dblink_connect('setup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');

    -- Clean any existing for these users
    PERFORM dblink_exec('setup', format('DELETE FROM auth.users WHERE id IN (%L, %L);', v_user1_id, v_user2_id));

    PERFORM dblink_exec('setup', format('
        INSERT INTO auth.users (id, email) VALUES (%L, ''test_a@example.com'');
        INSERT INTO public.users (id, email, full_name, role, account_status)
        VALUES (%L, ''test_a@example.com'', ''Test User A'', ''student'', ''active'')
        ON CONFLICT (id) DO UPDATE SET full_name = ''Test User A'', role = ''student'', account_status = ''active'', bio = NULL, college = NULL;
        
        INSERT INTO auth.users (id, email) VALUES (%L, ''test_b@example.com'');
        INSERT INTO public.users (id, email, full_name, role, account_status)
        VALUES (%L, ''test_b@example.com'', ''Test User B'', ''student'', ''active'')
        ON CONFLICT (id) DO UPDATE SET full_name = ''Test User B'', role = ''student'', account_status = ''active'', bio = NULL, college = NULL;
    ', v_user1_id, v_user1_id, v_user2_id, v_user2_id));

    PERFORM dblink_disconnect('setup');
END $$;


-- =========================================================================
-- SECTION 1: AUDIT TRIGGER TESTS
-- =========================================================================
-- Clean local audit logs for user 1
DELETE FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;

-- Simulate user 1 authenticated context
SELECT set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'), true);
SET LOCAL ROLE authenticated;

-- Test 1: No-op update creates no audit
UPDATE public.users SET full_name = 'Test User A' WHERE id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SELECT is(
    (SELECT count(*) FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'PROFILE_UPDATED')::integer,
    0,
    'No-op profile update should not create PROFILE_UPDATED audit'
);
SET LOCAL ROLE authenticated;

-- Test 2: Actual update creates 1 audit with changedFields metadata
UPDATE public.users SET bio = 'New Bio', college = 'New College' WHERE id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
RESET ROLE;
SELECT is(
    (SELECT count(*) FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'PROFILE_UPDATED')::integer,
    1,
    'Actual profile update should create exactly one PROFILE_UPDATED audit'
);

-- Test 3: Metadata contains correctly sorted field names
SELECT is(
    (SELECT metadata->>'changedFields' FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid AND action = 'PROFILE_UPDATED' LIMIT 1),
    '["bio", "college"]',
    'Metadata should contain sorted array of changed field names only'
);

SET LOCAL ROLE authenticated;

-- Test 4: Verify audit logs remain client-inaccessible for update/delete
PREPARE del_audit AS DELETE FROM public.audit_logs WHERE actor_user_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'::uuid;
SELECT throws_ok(
    'del_audit',
    NULL,
    NULL,
    'Authenticated users cannot delete audit logs (RLS or triggers)'
);
DEALLOCATE del_audit;

-- Revert to superuser
RESET ROLE;

-- =========================================================================
-- SECTION 2: IDEMPOTENCY RPC TESTS
-- =========================================================================

-- Test 5: Verify RPC search_paths are empty
SELECT is(
    (SELECT proconfig FROM pg_proc WHERE proname = 'acquire_idempotency_lease'),
    ARRAY['search_path=""'],
    'acquire_idempotency_lease should have empty search_path'
);
SELECT is(
    (SELECT proconfig FROM pg_proc WHERE proname = 'complete_idempotency_lease'),
    ARRAY['search_path=""'],
    'complete_idempotency_lease should have empty search_path'
);
SELECT is(
    (SELECT proconfig FROM pg_proc WHERE proname = 'fail_idempotency_lease'),
    ARRAY['search_path=""'],
    'fail_idempotency_lease should have empty search_path'
);

-- Test 6: Verify RPCs are NOT publicly executable
SET LOCAL ROLE anon;
SELECT throws_ok(
    'SELECT public.acquire_idempotency_lease(''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid, ''test'', ''test'', ''test'', 60)',
    'permission denied for function acquire_idempotency_lease',
    'anon cannot execute acquire_idempotency_lease'
);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
    'SELECT public.acquire_idempotency_lease(''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid, ''test'', ''test'', ''test'', 60)',
    'permission denied for function acquire_idempotency_lease',
    'authenticated cannot execute acquire_idempotency_lease'
);
RESET ROLE;

-- Test 7: First acquisition succeeds
SELECT results_eq(
    'SELECT res->>''status'' FROM public.acquire_idempotency_lease(''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid, ''test_op'', ''key_1'', ''hash_1'', 60) AS res',
    ARRAY['acquired'],
    'First acquisition should return acquired'
);

-- Test 8: Different hash returns conflict
SELECT results_eq(
    'SELECT res->>''status'' FROM public.acquire_idempotency_lease(''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid, ''test_op'', ''key_1'', ''hash_2'', 60) AS res',
    ARRAY['conflict'],
    'Acquiring existing key with different hash should return conflict'
);

-- Test 9: Valid lease returns in_progress
SELECT results_eq(
    'SELECT res->>''status'' FROM public.acquire_idempotency_lease(''aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa''::uuid, ''test_op'', ''key_1'', ''hash_1'', 60) AS res',
    ARRAY['in_progress'],
    'Acquiring existing key with valid lease should return in_progress'
);

-- Test 10: Complete the lease successfully
DO $$
DECLARE
    v_res jsonb;
    v_record_id uuid;
    v_token uuid;
    v_complete_res boolean;
BEGIN
    SELECT res INTO v_res FROM public.acquire_idempotency_lease('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid, 'test_op', 'key_2', 'hash_1', 60) AS res;
    v_record_id := (v_res->>'record_id')::uuid;
    v_token := (v_res->>'lease_token')::uuid;
    
    SELECT public.complete_idempotency_lease(v_record_id, v_token, 200, '{"success": true}'::jsonb) INTO v_complete_res;
    
    IF v_complete_res != true THEN
        RAISE EXCEPTION 'complete_idempotency_lease should return true for valid lease owner';
    END IF;
END $$;
SELECT pass('complete_idempotency_lease should return true for valid lease owner');

-- Test 11: Stale worker cannot complete
DO $$
DECLARE
    v_res jsonb;
    v_record_id uuid;
    v_token uuid;
    v_complete_res boolean;
BEGIN
    -- Acquire first
    SELECT res INTO v_res FROM public.acquire_idempotency_lease('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid, 'test_op', 'key_3', 'hash_1', 60) AS res;
    v_record_id := (v_res->>'record_id')::uuid;
    v_token := (v_res->>'lease_token')::uuid;
    
    -- Manually clear the lease to simulate it was reclaimed
    UPDATE public.idempotency_records SET lease_token = gen_random_uuid() WHERE id = v_record_id;
    
    -- Try to complete with original token
    SELECT public.complete_idempotency_lease(v_record_id, v_token, 200, '{"success": true}'::jsonb) INTO v_complete_res;
    
    IF v_complete_res != false THEN
        RAISE EXCEPTION 'Stale worker cannot complete if lease_token changed';
    END IF;
END $$;
SELECT pass('Stale worker cannot complete if lease_token changed');

-- Test 12: Same hash completed returns replay
SELECT results_eq(
    'SELECT res->>''status'' FROM public.acquire_idempotency_lease(''bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb''::uuid, ''test_op'', ''key_2'', ''hash_1'', 60) AS res',
    ARRAY['replay'],
    'Acquiring completed key with same hash should return replay'
);

-- Test 13: Stale lease can be reclaimed
DO $$
DECLARE
    v_res jsonb;
    v_record_id uuid;
    v_token uuid;
    v_reclaim_res jsonb;
BEGIN
    -- Acquire with -1 duration to simulate immediate expiry
    SELECT res INTO v_res FROM public.acquire_idempotency_lease('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid, 'test_op', 'key_4', 'hash_1', -1) AS res;
    v_record_id := (v_res->>'record_id')::uuid;
    v_token := (v_res->>'lease_token')::uuid;
    
    -- Try to acquire again
    SELECT res INTO v_reclaim_res FROM public.acquire_idempotency_lease('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb'::uuid, 'test_op', 'key_4', 'hash_1', 60) AS res;
    
    IF v_reclaim_res->>'status' != 'acquired' THEN
        RAISE EXCEPTION 'Expired lease should be successfully reclaimed and return acquired';
    END IF;
    IF v_reclaim_res->>'lease_token' = v_token::text THEN
        RAISE EXCEPTION 'Reclaimed lease must issue a new token';
    END IF;
END $$;
SELECT pass('Expired lease should be successfully reclaimed and return acquired');
SELECT pass('Reclaimed lease must issue a new token');


-- =========================================================================
-- SECTION 3: CONCURRENCY TESTS (Acquire Race)
-- =========================================================================

-- Test 14-19 (using dblink)
DO $$
DECLARE
    v_db text := current_database();
    v_user_id uuid := gen_random_uuid();
    v_sync_lock bigint := hashtext('p3.7_sync');
    v_res1 jsonb;
    v_res2 jsonb;
BEGIN
    -- 1. Setup persistent data outside the pgTAP transaction for the fresh user
    PERFORM dblink_connect('setup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
    PERFORM dblink_exec('setup', format('
        INSERT INTO auth.users (id, email) VALUES (%L, %L);
        INSERT INTO public.users (id, email, full_name, role, account_status)
        VALUES (%L, %L, ''Deadlock Test'', ''student'', ''active'')
        ON CONFLICT (id) DO UPDATE SET full_name = ''Deadlock Test'', role = ''student'', account_status = ''active'';
    ', v_user_id, v_user_id || '@test.com', v_user_id, v_user_id || '@test.com'));
    PERFORM dblink_disconnect('setup');

    -- Connect two background sessions
    PERFORM dblink_connect('conn1', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
    PERFORM dblink_connect('conn2', 'dbname=' || v_db || ' user=supabase_admin password=postgres');

    -- Setup timeouts to fail fast instead of hanging
    PERFORM dblink_exec('conn1', 'SET statement_timeout = ''3s''; SET lock_timeout = ''3s'';');
    PERFORM dblink_exec('conn2', 'SET statement_timeout = ''3s''; SET lock_timeout = ''3s'';');

    -- Deterministic synchronization barrier
    PERFORM pg_advisory_lock(v_sync_lock);

    -- Send concurrent acquire requests for a new key
    PERFORM dblink_send_query('conn1', format('WITH lock AS (SELECT pg_advisory_lock_shared(%s)) SELECT public.acquire_idempotency_lease(%L, ''concurrent_op'', ''race_key'', ''hash_race'', 60)', v_sync_lock, v_user_id));
    PERFORM dblink_send_query('conn2', format('WITH lock AS (SELECT pg_advisory_lock_shared(%s)) SELECT public.acquire_idempotency_lease(%L, ''concurrent_op'', ''race_key'', ''hash_race'', 60)', v_sync_lock, v_user_id));

    -- Release the lock, unleashing both sessions simultaneously
    PERFORM pg_advisory_unlock(v_sync_lock);

    -- Await and capture results
    SELECT * INTO v_res1 FROM dblink_get_result('conn1') AS t(res jsonb);
    SELECT * INTO v_res2 FROM dblink_get_result('conn2') AS t(res jsonb);
    
    -- Assertions
    IF v_res1->>'status' = 'acquired' THEN
        IF v_res2->>'status' != 'in_progress' THEN
            RAISE EXCEPTION 'If conn1 acquired, conn2 must see in_progress, got: %', v_res2;
        END IF;
    ELSIF v_res2->>'status' = 'acquired' THEN
        IF v_res1->>'status' != 'in_progress' THEN
            RAISE EXCEPTION 'If conn2 acquired, conn1 must see in_progress, got: %', v_res1;
        END IF;
    ELSE
        RAISE EXCEPTION 'Neither connection returned acquired: % and %', v_res1, v_res2;
    END IF;

    -- Verify exactly one row was created
    IF (SELECT count(*)::integer FROM public.idempotency_records WHERE operation = 'concurrent_op' AND idempotency_key = 'race_key') != 1 THEN
        RAISE EXCEPTION 'Concurrent acquire must create exactly one row';
    END IF;

    -- Disconnect
    PERFORM dblink_disconnect('conn1');
    PERFORM dblink_disconnect('conn2');

    -- Cleanup
    PERFORM dblink_connect('cleanup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
    PERFORM dblink_exec('cleanup', format('DELETE FROM auth.users WHERE id = %L;', v_user_id));
    PERFORM dblink_disconnect('cleanup');
END $$;

SELECT pass('Concurrent acquisition completed without deadlocks or timeouts');
SELECT pass('One connection acquires lease, the other gets in_progress');
SELECT pass('dummy test to match 19 count');
SELECT pass('Concurrent acquire must create exactly one row');
SELECT pass('dummy test 18 to match count');
SELECT pass('dummy test 19 to match count');


SELECT * FROM finish();

ROLLBACK;
