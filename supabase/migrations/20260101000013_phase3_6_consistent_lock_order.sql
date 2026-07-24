-- Migration 13: Phase 3.6 Consistent Lock Order
-- Fixes deadlock risk between prepare and finalize by ensuring both lock
-- the idempotency record first, then the user row second.

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
    v_inserted           BOOLEAN := FALSE;
BEGIN
    -- ----------------------------------------------------------------
    -- 1. Reserve and Lock Idempotency (Order: 1)
    --    This matches the lock order in finalize_soft_delete_account.
    -- ----------------------------------------------------------------
    INSERT INTO public.idempotency_records
           (user_id, idempotency_key, operation, request_hash, status, expires_at)
    VALUES (p_user_id, p_idempotency_key, p_operation, p_request_hash,
            'processing', NOW() + INTERVAL '24 hours')
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING
    RETURNING TRUE INTO v_inserted;

    IF v_inserted IS NULL THEN v_inserted := FALSE; END IF;

    -- Always lock the record explicitly so we hold the row lock
    SELECT status::text, request_hash, operation, response_status, response_body
      INTO v_reservation_status, v_existing_hash, v_existing_operation,
           v_response_status, v_response_body
      FROM public.idempotency_records
     WHERE user_id         = p_user_id
       AND operation       = p_operation
       AND idempotency_key = p_idempotency_key
       FOR UPDATE;

    IF NOT v_inserted THEN
        -- Existing record checks
        IF v_existing_hash != p_request_hash OR v_existing_operation != p_operation THEN
            RETURN jsonb_build_object('status', 'conflict');
        END IF;

        IF v_reservation_status = 'completed' THEN
            RETURN jsonb_build_object(
                'status',          'completed',
                'response_status', v_response_status,
                'response_body',   v_response_body
            );
        END IF;
    END IF;

    -- ----------------------------------------------------------------
    -- 2. Lock the user row FOR UPDATE (Order: 2)
    -- ----------------------------------------------------------------
    SELECT account_status::text, deleted_at
      INTO v_account_status, v_deleted_at
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

    -- Process based on existing idempotency state
    IF NOT v_inserted THEN
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
    -- 3. Process new request and transition account state
    -- ----------------------------------------------------------------
    IF v_account_status = 'suspended' THEN
        UPDATE public.idempotency_records SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_suspended');
    END IF;

    IF v_account_status = 'deletion_pending' THEN
        UPDATE public.idempotency_records SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_deletion_pending');
    END IF;

    IF v_account_status = 'deleted' OR v_deleted_at IS NOT NULL THEN
        UPDATE public.idempotency_records SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
    END IF;

    IF v_account_status != 'active' THEN
        UPDATE public.idempotency_records SET status = 'failed', updated_at = NOW()
         WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'unknown_account_state');
    END IF;

    UPDATE public.users
       SET account_status = 'deletion_pending',
           updated_at     = NOW()
     WHERE id             = p_user_id;

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
