-- pgTAP test: 0012_phase3_6_deletion_state_lock_contract.sql
--
-- Proves that an account-state change between prepare_soft_delete_account
-- and finalize_soft_delete_account cannot produce an unauthorized deletion.
--
-- Cases tested:
--   1. Happy path: active → prepare → finalize → deleted
--   2. Suspended at prepare time → prepare returns account_suspended (NOT deleted)
--   3. State changes to suspended AFTER prepare → finalize returns state_changed (NOT deleted)
--   4. Prepare against deletion_pending returns account_deletion_pending
--   5. Prepare against already-deleted account returns account_already_deleted
--   6. Finalize replay on completed record returns 200 without re-deleting

BEGIN;

SELECT plan(14);

-- ============================================================
-- Helpers
-- ============================================================
DO $$
BEGIN
  -- Ensure we can insert test users
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'users'
  ) THEN
    RAISE EXCEPTION 'public.users table not found';
  END IF;
END $$;

-- ============================================================
-- Case 1: Happy path – active → prepare → finalize → deleted
-- ============================================================
DO $$
DECLARE
  v_user_id  UUID := gen_random_uuid();
  v_key      TEXT := 'happy-path-key-' || gen_random_uuid()::text;
  v_hash     TEXT := 'abc123';
  v_op       TEXT := 'account_deletion';
  v_result   JSONB;
  v_status   TEXT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'happy@test.example.com');
  UPDATE public.users
     SET full_name = 'Happy', role = 'student', account_status = 'active'
   WHERE id = v_user_id;

  -- prepare
  v_result := public.prepare_soft_delete_account(v_user_id, v_key, v_hash, v_op);
  IF v_result->>'status' != 'processing' THEN
    RAISE EXCEPTION 'Case 1 prepare: expected processing, got %', v_result;
  END IF;

  -- account should now be deletion_pending
  SELECT account_status::text INTO v_status FROM public.users WHERE id = v_user_id;
  IF v_status != 'deletion_pending' THEN
    RAISE EXCEPTION 'Case 1: expected deletion_pending after prepare, got %', v_status;
  END IF;

  -- finalize
  v_result := public.finalize_soft_delete_account(v_user_id, v_key, v_op, NULL::uuid);
  IF v_result->>'status' != 'completed' THEN
    RAISE EXCEPTION 'Case 1 finalize: expected completed, got %', v_result;
  END IF;

  -- account should be deleted
  SELECT account_status::text INTO v_status FROM public.users WHERE id = v_user_id;
  IF v_status != 'deleted' THEN
    RAISE EXCEPTION 'Case 1: expected deleted after finalize, got %', v_status;
  END IF;
END $$;

SELECT pass('Case 1: happy path active → prepare → finalize → deleted');
SELECT pass('Case 1: account_status is deletion_pending between stages');

-- ============================================================
-- Case 2: Suspended at prepare time → refused, NOT deleted
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key     TEXT := 'suspended-prepare-key-' || gen_random_uuid()::text;
  v_result  JSONB;
  v_status  TEXT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'suspended@test.example.com');
  UPDATE public.users
     SET full_name = 'Suspended', role = 'student', account_status = 'suspended'
   WHERE id = v_user_id;

  v_result := public.prepare_soft_delete_account(v_user_id, v_key, 'h2', 'account_deletion');
  IF v_result->>'status' != 'failed' OR v_result->>'reason' != 'account_suspended' THEN
    RAISE EXCEPTION 'Case 2: expected failed/account_suspended, got %', v_result;
  END IF;

  SELECT account_status::text INTO v_status FROM public.users WHERE id = v_user_id;
  IF v_status != 'suspended' THEN
    RAISE EXCEPTION 'Case 2: suspended account must not be modified, got %', v_status;
  END IF;
END $$;

SELECT pass('Case 2: prepare returns account_suspended for suspended account');
SELECT pass('Case 2: suspended account status unchanged after refused prepare');

-- ============================================================
-- Case 3: State changes to suspended AFTER prepare
--         → finalize returns state_changed, NOT deleted
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key     TEXT := 'race-key-' || gen_random_uuid()::text;
  v_result  JSONB;
  v_status  TEXT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'race@test.example.com');
  UPDATE public.users
     SET full_name = 'Race', role = 'student', account_status = 'active'
   WHERE id = v_user_id;

  -- prepare succeeds (account is active)
  v_result := public.prepare_soft_delete_account(v_user_id, v_key, 'h3', 'account_deletion');
  IF v_result->>'status' != 'processing' THEN
    RAISE EXCEPTION 'Case 3 prepare: expected processing, got %', v_result;
  END IF;

  -- Simulate: admin suspends the account AFTER prepare ran.
  -- We bypass the RPC and directly update the row (simulating an admin action
  -- or a different code path that can change account_status).
  UPDATE public.users
     SET account_status = 'suspended'
   WHERE id = v_user_id;

  -- finalize must fail closed, NOT delete the suspended account
  v_result := public.finalize_soft_delete_account(v_user_id, v_key, 'account_deletion', NULL::uuid);
  IF v_result->>'status' != 'failed' OR v_result->>'reason' != 'state_changed' THEN
    RAISE EXCEPTION 'Case 3 finalize: expected failed/state_changed, got %', v_result;
  END IF;

  -- Account must remain suspended, not deleted
  SELECT account_status::text INTO v_status FROM public.users WHERE id = v_user_id;
  IF v_status = 'deleted' THEN
    RAISE EXCEPTION 'Case 3: suspended account was illegally deleted!';
  END IF;
  IF v_status != 'suspended' THEN
    RAISE EXCEPTION 'Case 3: expected suspended, got %', v_status;
  END IF;
END $$;

SELECT pass('Case 3: finalize returns state_changed when account becomes suspended after prepare');
SELECT pass('Case 3: suspended account is NOT deleted when state changes after prepare');

-- ============================================================
-- Case 4: New key against deletion_pending → account_deletion_pending
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key1    TEXT := 'first-key-' || gen_random_uuid()::text;
  v_key2    TEXT := 'second-key-' || gen_random_uuid()::text;
  v_result  JSONB;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'pending@test.example.com');
  UPDATE public.users
     SET full_name = 'Pending', role = 'student', account_status = 'active'
   WHERE id = v_user_id;

  -- First prepare puts account in deletion_pending
  v_result := public.prepare_soft_delete_account(v_user_id, v_key1, 'h4a', 'account_deletion');
  IF v_result->>'status' != 'processing' THEN
    RAISE EXCEPTION 'Case 4 first prepare: expected processing, got %', v_result;
  END IF;

  -- Second prepare with different key must return account_deletion_pending
  v_result := public.prepare_soft_delete_account(v_user_id, v_key2, 'h4b', 'account_deletion');
  IF v_result->>'status' != 'failed' OR v_result->>'reason' != 'account_deletion_pending' THEN
    RAISE EXCEPTION 'Case 4 second prepare: expected failed/account_deletion_pending, got %', v_result;
  END IF;
END $$;

SELECT pass('Case 4: new key against deletion_pending account returns account_deletion_pending');

-- ============================================================
-- Case 5: Prepare against already-deleted account → account_already_deleted
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key     TEXT := 'deleted-key-' || gen_random_uuid()::text;
  v_result  JSONB;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'deleted@test.example.com');
  UPDATE public.users
     SET full_name = 'Deleted', role = 'student',
         account_status = 'deleted', deleted_at = NOW()
   WHERE id = v_user_id;

  v_result := public.prepare_soft_delete_account(v_user_id, v_key, 'h5', 'account_deletion');
  IF v_result->>'status' != 'failed' OR v_result->>'reason' != 'account_already_deleted' THEN
    RAISE EXCEPTION 'Case 5: expected failed/account_already_deleted, got %', v_result;
  END IF;
END $$;

SELECT pass('Case 5: prepare against already-deleted account returns account_already_deleted');

-- ============================================================
-- Case 6: Finalize replay on completed record returns 200
--         without re-deleting
-- ============================================================
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key     TEXT := 'replay-key-' || gen_random_uuid()::text;
  v_result  JSONB;
  v_count   INT;
BEGIN
  INSERT INTO auth.users (id, email) VALUES (v_user_id, 'replay@test.example.com');
  UPDATE public.users
     SET full_name = 'Replay', role = 'student', account_status = 'active'
   WHERE id = v_user_id;

  -- prepare + finalize (first time)
  PERFORM public.prepare_soft_delete_account(v_user_id, v_key, 'h6', 'account_deletion');
  PERFORM public.finalize_soft_delete_account(v_user_id, v_key, 'account_deletion', NULL::uuid);

  -- Count audit log entries before replay
  SELECT count(*) INTO v_count
    FROM public.audit_logs
   WHERE actor_user_id = v_user_id AND action = 'ACCOUNT_DEACTIVATED';

  -- Replay finalize (same key, already completed)
  v_result := public.finalize_soft_delete_account(v_user_id, v_key, 'account_deletion', NULL::uuid);
  IF v_result->>'status' != 'completed' THEN
    RAISE EXCEPTION 'Case 6 replay: expected completed, got %', v_result;
  END IF;
  IF (v_result->>'response_status')::int != 200 THEN
    RAISE EXCEPTION 'Case 6 replay: expected response_status 200, got %', v_result;
  END IF;

  -- Audit log count must not increase on replay
  IF (
    SELECT count(*) FROM public.audit_logs
     WHERE actor_user_id = v_user_id AND action = 'ACCOUNT_DEACTIVATED'
  ) != v_count THEN
    RAISE EXCEPTION 'Case 6: finalize replay wrote a duplicate audit log entry';
  END IF;
END $$;

SELECT pass('Case 6: finalize replay returns 200 without duplicate audit log');
SELECT pass('Case 6: audit log count unchanged on finalize replay');

SELECT * FROM finish();

ROLLBACK;
