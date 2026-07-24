-- pgTAP test: 0013_phase3_6_consistent_lock_order_contract.sql
-- Proves that prepare_soft_delete_account and finalize_soft_delete_account
-- lock resources in a consistent order (idempotency record first, user row second)
-- and do not deadlock under concurrent execution.

BEGIN;

SELECT plan(1);

-- We use dblink to simulate true concurrent database sessions.
CREATE EXTENSION IF NOT EXISTS dblink;

DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_key TEXT := 'deadlock-key-' || gen_random_uuid()::text;
  v_db TEXT := current_database();
BEGIN
  -- 1. Setup persistent data outside the pgTAP transaction so dblink connections can see it.
  -- By using supabase_admin (the default local superuser), we bypass the dblink restriction
  -- that forbids non-superusers from connecting to a 'trust' configured local server.
  PERFORM dblink_connect('setup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
  PERFORM dblink_exec('setup', format('
      INSERT INTO auth.users (id, email) VALUES (%L, %L);
      INSERT INTO public.users (id, email, full_name, role, account_status)
      VALUES (%L, %L, ''Deadlock Test'', ''student'', ''active'')
      ON CONFLICT (id) DO UPDATE SET full_name = ''Deadlock Test'', role = ''student'', account_status = ''active'';
  ', v_user_id, v_user_id || '@test.com', v_user_id, v_user_id || '@test.com'));
  PERFORM dblink_disconnect('setup');

  -- 2. Open two concurrent sessions
  PERFORM dblink_connect('conn1', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
  PERFORM dblink_connect('conn2', 'dbname=' || v_db || ' user=supabase_admin password=postgres');

  -- 3. Trigger concurrent execution
  -- Session 1 initiates prepare_soft_delete_account
  PERFORM dblink_send_query('conn1', format('SELECT public.prepare_soft_delete_account(%L, %L, ''hash1'', ''account_deletion'')', v_user_id, v_key));
  -- Session 2 initiates finalize_soft_delete_account concurrently
  PERFORM dblink_send_query('conn2', format('SELECT public.finalize_soft_delete_account(%L, %L, ''account_deletion'', NULL::uuid)', v_user_id, v_key));

  -- 4. Await results.
  -- If lock order is inconsistent, postgres will resolve the deadlock by aborting one transaction,
  -- which will raise an exception here.
  PERFORM * FROM dblink_get_result('conn1') AS t(res jsonb);
  PERFORM * FROM dblink_get_result('conn2') AS t(res jsonb);

  PERFORM dblink_disconnect('conn1');
  PERFORM dblink_disconnect('conn2');

  -- 5. Cleanup
  PERFORM dblink_connect('cleanup', 'dbname=' || v_db || ' user=supabase_admin password=postgres');
  PERFORM dblink_exec('cleanup', format('DELETE FROM auth.users WHERE id = %L', v_user_id));
  PERFORM dblink_disconnect('cleanup');
END $$;

SELECT pass('Concurrent execution of prepare and finalize completed without deadlock');

SELECT * FROM finish();

ROLLBACK;

ROLLBACK;
