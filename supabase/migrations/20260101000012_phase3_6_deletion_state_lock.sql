-- Migration 12: Phase 3.6 Deletion State Lock (Concurrency Safety)
--
-- Problem: Prior migrations read account_status without FOR UPDATE, creating a
-- race where the account state can change between prepare and finalize:
--
--   Prepare reads account as active
--          ↓
--   Account becomes suspended (e.g. admin action) before finalization
--          ↓
--   Session revocation completes
--          ↓
--   Finalizer changes suspended account to deleted  ← WRONG
--
-- Additionally: migration 07 created finalize_soft_delete_account(UUID, TEXT, TEXT)
-- (3-arg) and migration 08 created the 4-arg version with UUID DEFAULT NULL.
-- Both overloads coexist, making any 3-arg call ambiguous. Drop the stale 3-arg
-- version here so only the canonical 4-arg signature remains.

-- Drop the stale 3-arg overload introduced by migration 07.
DROP FUNCTION IF EXISTS public.finalize_soft_delete_account(UUID, TEXT, TEXT);



-- Fix – two invariants enforced:
--
--   prepare_soft_delete_account:
--     • Locks the user row with FOR UPDATE before any idempotency logic.
--     • Atomically transitions active → deletion_pending only.
--       The physical deletion is deferred to finalize (two-phase protocol).
--     • New idempotency keys against deletion_pending return
--       'account_deletion_pending' (caller maps to 403 ACCOUNT_DELETED).
--     • Same-key retries against deletion_pending resume session revocation
--       (idempotency replay path is fully preserved).
--
--   finalize_soft_delete_account:
--     • Re-locks the user row with FOR UPDATE after securing the idempotency
--       record; rechecks that the row is still deletion_pending.
--     • Fails closed (reason: state_changed) if the state is anything other
--       than deletion_pending.
--     • Allows finalization ONLY from deletion_pending.
--     • Preserves completed replay as 200.

CREATE OR REPLACE FUNCTION public.prepare_soft_delete_account(
    p_user_id         UUID,
    p_idempotency_key TEXT,
    p_request_hash    TEXT,
    p_operation       TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_account_status     TEXT;
    v_deleted_at         TIMESTAMPTZ;
    v_reservation_status TEXT;
    v_existing_hash      TEXT;
    v_existing_operation TEXT;
    v_response_status    INT;
    v_response_body      JSONB;
BEGIN
    -- ----------------------------------------------------------------
    -- 1. Lock the user row FOR UPDATE before any idempotency work.
    --    Concurrent callers block here, serialising state transitions.
    -- ----------------------------------------------------------------
    SELECT account_status::text, deleted_at
      INTO v_account_status, v_deleted_at
      FROM public.users
     WHERE id = p_user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'user_not_found');
    END IF;

    -- ----------------------------------------------------------------
    -- 2. Reserve Idempotency.
    --    Same-key concurrent callers hit ON CONFLICT and fall into the
    --    'existing record' branch, where they resume session revocation.
    -- ----------------------------------------------------------------
    INSERT INTO public.idempotency_records
           (user_id, idempotency_key, operation, request_hash, status, expires_at)
    VALUES (p_user_id, p_idempotency_key, p_operation, p_request_hash,
            'processing', NOW() + INTERVAL '24 hours')
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING;

    IF NOT FOUND THEN
        -- Existing record: fetch its state.
        SELECT status::text, request_hash, operation, response_status, response_body
          INTO v_reservation_status, v_existing_hash, v_existing_operation,
               v_response_status, v_response_body
          FROM public.idempotency_records
         WHERE user_id         = p_user_id
           AND operation       = p_operation
           AND idempotency_key = p_idempotency_key;

        -- Different request hash or operation for same key → conflict.
        IF v_existing_hash != p_request_hash OR v_existing_operation != p_operation THEN
            RETURN jsonb_build_object('status', 'conflict');
        END IF;

        -- Completed replay – return stored response.
        IF v_reservation_status = 'completed' THEN
            RETURN jsonb_build_object(
                'status',          'completed',
                'response_status', v_response_status,
                'response_body',   v_response_body
            );
        END IF;

        -- Previously failed – map current account state to the correct reason.
        IF v_reservation_status = 'failed' THEN
            IF v_account_status = 'suspended' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_suspended');
            ELSIF v_account_status IN ('deletion_pending', 'deleted') OR v_deleted_at IS NOT NULL THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
            ELSIF v_account_status != 'active' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'unknown_account_state');
            END IF;
            RETURN jsonb_build_object('status', 'failed');
        END IF;

        -- Still processing: safe retry, resume session revocation.
        RETURN jsonb_build_object(
            'status', 'processing',
            'reason', 'session_revocation_required'
        );
    END IF;

    -- ----------------------------------------------------------------
    -- 3. We own the idempotency reservation.
    --    Enforce account state rules using the locked row value from step 1.
    -- ----------------------------------------------------------------

    -- Suspended: caller must receive 403 ACCOUNT_DISABLED.
    IF v_account_status = 'suspended' THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_suspended');
    END IF;

    -- deletion_pending: another prepare has already queued deletion.
    -- New keys return account_deletion_pending → 403 ACCOUNT_DELETED.
    IF v_account_status = 'deletion_pending' THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_deletion_pending');
    END IF;

    -- Already deleted (by status or deleted_at sentinel).
    IF v_account_status = 'deleted' OR v_deleted_at IS NOT NULL THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
    END IF;

    -- Unknown state: fail closed.
    IF v_account_status != 'active' THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'unknown_account_state');
    END IF;

    -- ----------------------------------------------------------------
    -- 4. Atomically transition active → deletion_pending.
    --    The WHERE clause doubles as a guard: if the state changed between
    --    our FOR UPDATE read (step 1) and this UPDATE, the NOT FOUND branch
    --    fails closed.  Under normal operation this cannot happen because
    --    we still hold the FOR UPDATE lock, but we keep it for defence-in-depth.
    -- ----------------------------------------------------------------
    UPDATE public.users
       SET account_status = 'deletion_pending',
           updated_at     = NOW()
     WHERE id             = p_user_id
       AND account_status = 'active';

    IF NOT FOUND THEN
        -- Defensive: should be unreachable under lock, but fail closed.
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'state_changed');
    END IF;

    -- ----------------------------------------------------------------
    -- 5. Return processing – caller must perform session revocation then
    --    call finalize_soft_delete_account.
    -- ----------------------------------------------------------------
    RETURN jsonb_build_object(
        'status', 'processing',
        'reason', 'session_revocation_required'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT)
    FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT)
    TO service_role;

-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.finalize_soft_delete_account(
    p_user_id         UUID,
    p_idempotency_key TEXT,
    p_operation       TEXT,
    p_request_id      UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record_status   TEXT;
    v_response_status INT  := 200;
    v_response_body   JSONB := jsonb_build_object(
        'success', true,
        'account', jsonb_build_object('status', 'deleted')
    );
    v_account_status  TEXT;
BEGIN
    -- ----------------------------------------------------------------
    -- 1. Secure the idempotency record with FOR UPDATE.
    --    Only proceed when it is in 'processing' state.
    -- ----------------------------------------------------------------
    SELECT status::text
      INTO v_record_status
      FROM public.idempotency_records
     WHERE user_id         = p_user_id
       AND operation       = p_operation
       AND idempotency_key = p_idempotency_key
       FOR UPDATE;

    IF v_record_status IS NULL THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'record_not_found');
    END IF;

    -- Completed replay.
    IF v_record_status = 'completed' THEN
        SELECT response_status, response_body
          INTO v_response_status, v_response_body
          FROM public.idempotency_records
         WHERE user_id         = p_user_id
           AND operation       = p_operation
           AND idempotency_key = p_idempotency_key;

        RETURN jsonb_build_object(
            'status',          'completed',
            'response_status', v_response_status,
            'response_body',   v_response_body
        );
    END IF;

    IF v_record_status != 'processing' THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'record_not_processing');
    END IF;

    -- ----------------------------------------------------------------
    -- 2. Re-lock the user row and recheck state.
    --    This is the key concurrency guard: even if the account was
    --    suspended AFTER prepare ran, we detect it here and fail closed
    --    instead of silently deleting a suspended account.
    -- ----------------------------------------------------------------
    SELECT account_status::text
      INTO v_account_status
      FROM public.users
     WHERE id = p_user_id
       FOR UPDATE;

    IF NOT FOUND THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'user_not_found');
    END IF;

    -- The account MUST be in deletion_pending.  Any other state means
    -- something changed after prepare ran – fail closed.
    IF v_account_status != 'deletion_pending' THEN
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'state_changed');
    END IF;

    -- ----------------------------------------------------------------
    -- 3. Perform the actual deletion.
    -- ----------------------------------------------------------------
    UPDATE public.users
       SET account_status = 'deleted',
           deleted_at     = NOW(),
           updated_at     = NOW()
     WHERE id             = p_user_id
       AND account_status = 'deletion_pending';

    IF NOT FOUND THEN
        -- Defensive: unreachable under lock; fail closed anyway.
        UPDATE public.idempotency_records
           SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation
           AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'state_changed');
    END IF;

    -- ----------------------------------------------------------------
    -- 4. Audit log.
    -- ----------------------------------------------------------------
    INSERT INTO public.audit_logs
           (actor_user_id, actor_type, action, resource_type, resource_id,
            metadata, request_id)
    VALUES (p_user_id, 'user', 'ACCOUNT_DEACTIVATED', 'user_profile', p_user_id,
            jsonb_build_object('result', 'deleted'), p_request_id);

    -- ----------------------------------------------------------------
    -- 5. Mark idempotency record completed.
    -- ----------------------------------------------------------------
    UPDATE public.idempotency_records
       SET status          = 'completed',
           response_status = v_response_status,
           response_body   = v_response_body,
           updated_at      = NOW()
     WHERE user_id         = p_user_id
       AND operation       = p_operation
       AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object(
        'status',          'completed',
        'response_status', v_response_status,
        'response_body',   v_response_body
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT, UUID)
    FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT, UUID)
    TO service_role;
