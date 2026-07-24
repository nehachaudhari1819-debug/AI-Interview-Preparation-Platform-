-- Migration 11: Phase 3.6 Deletion Authorization
-- Correctly handles suspended, deletion_pending, deleted, deleted_at IS NOT NULL, and unknown account states.

CREATE OR REPLACE FUNCTION public.prepare_soft_delete_account(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_request_hash TEXT,
    p_operation TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_account_status TEXT;
    v_deleted_at TIMESTAMPTZ;
    v_reservation_status TEXT;
    v_existing_hash TEXT;
    v_existing_operation TEXT;
    v_response_status INT;
    v_response_body JSONB;
BEGIN
    -- 1. Validate User Exists and fetch status & deleted_at
    SELECT account_status::text, deleted_at INTO v_account_status, v_deleted_at
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'user_not_found');
    END IF;

    -- 2. Reserve Idempotency FIRST (to correctly handle concurrent replays)
    INSERT INTO public.idempotency_records (user_id, idempotency_key, operation, request_hash, status, expires_at)
    VALUES (p_user_id, p_idempotency_key, p_operation, p_request_hash, 'processing', NOW() + INTERVAL '24 hours')
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING;

    IF NOT FOUND THEN
        -- Record exists, fetch its state
        SELECT status::text, request_hash, operation, response_status, response_body
        INTO v_reservation_status, v_existing_hash, v_existing_operation, v_response_status, v_response_body
        FROM public.idempotency_records
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

        IF v_existing_hash != p_request_hash OR v_existing_operation != p_operation THEN
            RETURN jsonb_build_object('status', 'conflict');
        END IF;

        IF v_reservation_status = 'completed' THEN
            RETURN jsonb_build_object('status', 'completed', 'response_status', v_response_status, 'response_body', v_response_body);
        END IF;

        IF v_reservation_status = 'failed' THEN
            -- Map to the correct error reason if it previously failed due to account state
            IF v_account_status = 'suspended' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_suspended');
            ELSIF v_account_status = 'deletion_pending' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_deletion_pending');
            ELSIF v_account_status = 'deleted' OR v_deleted_at IS NOT NULL THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
            ELSIF v_account_status != 'active' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'unknown_account_state');
            END IF;
            RETURN jsonb_build_object('status', 'failed');
        END IF;

        -- If processing, it's either concurrent OR a safe retry resuming session revocation
        RETURN jsonb_build_object('status', 'processing', 'reason', 'session_revocation_required');
    END IF;

    -- 3. Now check if account was ALREADY deleted, suspended, etc. (since this is a brand new request/idempotency key)
    IF v_account_status = 'suspended' THEN
        UPDATE public.idempotency_records
        SET status = 'failed'
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_suspended');
        
    ELSIF v_account_status = 'deletion_pending' THEN
        UPDATE public.idempotency_records
        SET status = 'failed'
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_deletion_pending');
        
    ELSIF v_account_status = 'deleted' OR v_deleted_at IS NOT NULL THEN
        UPDATE public.idempotency_records
        SET status = 'failed'
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
        
    ELSIF v_account_status != 'active' THEN
        UPDATE public.idempotency_records
        SET status = 'failed'
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('status', 'failed', 'reason', 'unknown_account_state');
    END IF;

    -- 4. Return processing to indicate lock acquired and safe to proceed
    RETURN jsonb_build_object('status', 'processing');
END;
$$;
