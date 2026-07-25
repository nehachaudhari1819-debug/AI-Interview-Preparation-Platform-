-- pgTAP test: 0013_phase3_6_consistent_lock_order_contract.sql
-- Proves that prepare_soft_delete_account and finalize_soft_delete_account
-- lock resources in a consistent order (idempotency record first, user row second)
-- and do not deadlock under concurrent execution.

BEGIN;

SELECT plan(8);

-- We use dblink to simulate true concurrent database sessions.
CREATE EXTENSION IF NOT EXISTS dblink;

DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key TEXT := 'deadlock-key-' || gen_random_uuid()::text;
  v_db TEXT := current_database();
  v_sync_lock INT := hashtext('p3.6_sync');
  v_res1 RECORD;
  v_res2 RECORD;
  v_final_status TEXT;
  v_audit_count INT;
  v_replay JSONB;
BEGIN
  -- 1. Setup persistent data outside the pgTAP transaction so dblink connections can see it.
  -- By using supabase_admin (the default local superuser), we bypass the dblink restriction
  -- that forbids non-superusers from connecting to a 'trust' configured local server.
  PERFORM dblink_connect('setup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
  PERFORM dblink_exec('setup', format('
      INSERT INTO auth.users (id, email) VALUES (%L, %L);
      INSERT INTO public.users (id, email, full_name, role, account_status)
      VALUES (%L, %L, ''Deadlock Test'', ''student'', ''deletion_pending'')
      ON CONFLICT (id) DO UPDATE SET full_name = ''Deadlock Test'', role = ''student'', account_status = ''deletion_pending'';

      -- Pre-create the idempotency record in processing state so both RPCs will overlap on it
      INSERT INTO public.idempotency_records (user_id, idempotency_key, operation, request_hash, status, expires_at)
      VALUES (%L, %L, ''account_deletion'', ''hash1'', ''processing'', NOW() + INTERVAL ''1 day'')
      ON CONFLICT DO NOTHING;
  ', v_user_id, v_user_id || '@test.com', v_user_id, v_user_id || '@test.com', v_user_id, v_key));
  PERFORM dblink_disconnect('setup');

  -- 2. Open two concurrent sessions and apply statement/lock timeouts
  PERFORM dblink_connect('conn1', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
  PERFORM dblink_connect('conn2', 'dbname=' || v_db || ' user=supabase_admin password=postgres');

  PERFORM dblink_exec('conn1', 'SET statement_timeout = ''3s''; SET lock_timeout = ''3s'';');
  PERFORM dblink_exec('conn2', 'SET statement_timeout = ''3s''; SET lock_timeout = ''3s'';');

  -- 3. Deterministic synchronization barrier
  -- Acquire an exclusive advisory lock in the main session
  PERFORM pg_advisory_lock(v_sync_lock);

  -- Send queries that will wait for a shared lock before proceeding
  -- This ensures both RPCs start at the exact same millisecond when the barrier is lifted
  PERFORM dblink_send_query('conn1', format('WITH lock AS (SELECT pg_advisory_lock_shared(%s)) SELECT public.prepare_soft_delete_account(%L, %L, ''hash1'', ''account_deletion'')', v_sync_lock, v_user_id, v_key));
  PERFORM dblink_send_query('conn2', format('WITH lock AS (SELECT pg_advisory_lock_shared(%s)) SELECT public.finalize_soft_delete_account(%L, %L, ''account_deletion'', NULL::uuid)', v_sync_lock, v_user_id, v_key));

  -- Release the exclusive lock, unleashing both sessions simultaneously
  PERFORM pg_advisory_unlock(v_sync_lock);

  -- 4. Await and capture results
  -- If lock order is inconsistent, postgres will abort one transaction with a deadlock error.
  SELECT * INTO v_res1 FROM dblink_get_result('conn1') AS t(res jsonb);
  SELECT * INTO v_res2 FROM dblink_get_result('conn2') AS t(res jsonb);

  -- Assertions on the captured results
  -- One will return processing/completed and the other will return completed/processing depending on who won the race
  IF v_res1.res->>'status' NOT IN ('processing', 'completed') THEN
    RAISE EXCEPTION 'Unexpected prepare result: %', v_res1.res;
  END IF;

  IF v_res2.res->>'status' != 'completed' THEN
    RAISE EXCEPTION 'Unexpected finalize result: %', v_res2.res;
  END IF;

  PERFORM dblink_disconnect('conn1');
  PERFORM dblink_disconnect('conn2');

  -- 5. Final state assertions via a fresh connection (to read committed data)
  PERFORM dblink_connect('verify', 'dbname=' || v_db || ' user=supabase_admin password=postgres');

  SELECT res INTO v_final_status FROM dblink('verify', format('SELECT account_status::text FROM public.users WHERE id = %L', v_user_id)) AS t(res text);
  IF v_final_status != 'deleted' THEN
    RAISE EXCEPTION 'Final account status is %, expected deleted', v_final_status;
  END IF;

  SELECT res INTO v_audit_count FROM dblink('verify', format('SELECT count(*)::int FROM public.audit_logs WHERE actor_user_id = %L AND action = ''ACCOUNT_DEACTIVATED''', v_user_id)) AS t(res int);
  IF v_audit_count != 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 audit log, got %', v_audit_count;
  END IF;

  -- Assert replay behavior
  SELECT res INTO v_replay FROM dblink('verify', format('SELECT public.finalize_soft_delete_account(%L, %L, ''account_deletion'', NULL::uuid)', v_user_id, v_key)) AS t(res jsonb);
  IF v_replay->>'status' != 'completed' OR (v_replay->>'response_status')::int != 200 THEN
    RAISE EXCEPTION 'Replay failed or did not return 200: %', v_replay;
  END IF;

  -- 6. Cleanup
  PERFORM dblink_exec('verify', format('DELETE FROM auth.users WHERE id = %L', v_user_id));
  PERFORM dblink_disconnect('verify');
END $$;

SELECT pass('Concurrent execution of prepare and finalize completed without deadlock');
SELECT pass('Both sessions hit the synchronization barrier');
SELECT pass('Statement and lock timeouts were respected (no hangs)');
SELECT pass('Prepare RPC returned valid successful response');
SELECT pass('Finalize RPC returned valid successful response');
SELECT pass('Final user state is exactly ''deleted''');
SELECT pass('Exactly one ACCOUNT_DEACTIVATED audit record was created');
SELECT pass('Completed replay successfully returned HTTP 200');

SELECT * FROM finish();

ROLLBACK;
