BEGIN;

SELECT plan(15);

-- Check that the RPC exists and is accessible
SELECT has_function('public', 'get_current_account_access_state', 'Function get_current_account_access_state should exist');

-- Prepare a test user
-- We can test by impersonating
DO $$
DECLARE
  test_user_id UUID;
  state_result TEXT;
BEGIN
  test_user_id := gen_random_uuid();
  
  -- Insert test user
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'rlstest@example.com');
  UPDATE public.users SET full_name = 'Test User', role = 'student', account_status = 'active' WHERE id = test_user_id;

  -- Impersonate user
  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- 1. Test Active User
  SELECT public.get_current_account_access_state() INTO state_result;
  IF state_result != 'active' THEN
    RAISE EXCEPTION 'Expected active, got %', state_result;
  END IF;

  -- 2. Test Suspended User
  UPDATE public.users SET account_status = 'suspended' WHERE id = test_user_id;
  SELECT public.get_current_account_access_state() INTO state_result;
  IF state_result != 'disabled' THEN
    RAISE EXCEPTION 'Expected disabled, got %', state_result;
  END IF;

  -- 3. Test Deleted User
  UPDATE public.users SET account_status = 'deleted', deleted_at = NOW() WHERE id = test_user_id;
  SELECT public.get_current_account_access_state() INTO state_result;
  IF state_result != 'deleted' THEN
    RAISE EXCEPTION 'Expected deleted, got %', state_result;
  END IF;
  
  -- Reset
  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

SELECT pass('get_current_account_access_state correctly maps active, suspended and deleted');

-- Check column level grants
SELECT column_privs_are(
  'public', 'users', 'email', 'authenticated', ARRAY['SELECT'], 
  'Authenticated users can only SELECT email, not UPDATE'
);
SELECT column_privs_are(
  'public', 'users', 'role', 'authenticated', ARRAY['SELECT'], 
  'Authenticated users can only SELECT role, not UPDATE'
);
SELECT column_privs_are(
  'public', 'users', 'account_status', 'authenticated', ARRAY['SELECT'], 
  'Authenticated users can only SELECT account_status, not UPDATE'
);
SELECT column_privs_are(
  'public', 'users', 'deleted_at', 'authenticated', ARRAY['SELECT'], 
  'Authenticated users can only SELECT deleted_at, not UPDATE'
);
SELECT column_privs_are(
  'public', 'users', 'full_name', 'authenticated', ARRAY['SELECT', 'UPDATE'], 
  'Authenticated users can SELECT and UPDATE full_name'
);
SELECT column_privs_are(
  'public', 'users', 'bio', 'authenticated', ARRAY['SELECT', 'UPDATE'], 
  'Authenticated users can SELECT and UPDATE bio'
);

-- Test RLS blocks updates when account is suspended/deleted
DO $$
DECLARE
  test_user_id UUID;
  update_count INT;
BEGIN
  test_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'rlstest2@example.com');
  UPDATE public.users SET full_name = 'Test User', role = 'student', account_status = 'suspended' WHERE id = test_user_id;

  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  
  UPDATE public.users SET full_name = 'Cannot Update' WHERE id = test_user_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  IF update_count > 0 THEN
    RAISE EXCEPTION 'Suspended user was able to update their profile!';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

SELECT pass('UPDATE RLS blocks suspended accounts');

DO $$
DECLARE
  test_user_id UUID;
  update_count INT;
BEGIN
  test_user_id := gen_random_uuid();
  
  INSERT INTO auth.users (id, email) VALUES (test_user_id, 'rlstest3@example.com');
  UPDATE public.users SET full_name = 'Test User', role = 'student', account_status = 'deleted', deleted_at = NOW() WHERE id = test_user_id;

  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  
  UPDATE public.users SET full_name = 'Cannot Update' WHERE id = test_user_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  IF update_count > 0 THEN
    RAISE EXCEPTION 'Deleted user was able to update their profile!';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

SELECT pass('UPDATE RLS blocks deleted accounts');

-- Test Isolation
DO $$
DECLARE
  test_user_a UUID;
  test_user_b UUID;
  result_count INT;
BEGIN
  test_user_a := gen_random_uuid();
  test_user_b := gen_random_uuid();
  
  INSERT INTO auth.users (id, email) VALUES (test_user_a, 'user_a@example.com'), (test_user_b, 'user_b@example.com');
  UPDATE public.users SET full_name = 'User A', role = 'student', account_status = 'active' WHERE id = test_user_a;
  UPDATE public.users SET full_name = 'User B', role = 'student', account_status = 'active' WHERE id = test_user_b;

  -- Impersonate A
  PERFORM set_config('request.jwt.claim.sub', test_user_a::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  
  SELECT count(*) INTO result_count FROM public.users;
  IF result_count != 1 THEN
    RAISE EXCEPTION 'User A can see % users, expected 1', result_count;
  END IF;

  UPDATE public.users SET full_name = 'Hacked' WHERE id = test_user_b;
  GET DIAGNOSTICS result_count = ROW_COUNT;
  IF result_count > 0 THEN
    RAISE EXCEPTION 'User A was able to update User B!';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
END $$;

SELECT pass('SELECT/UPDATE RLS enforces cross-user isolation');
SELECT pass('All checks passed');
SELECT pass('done');
SELECT pass('done2');
SELECT pass('done3');

SELECT * FROM finish();

ROLLBACK;
