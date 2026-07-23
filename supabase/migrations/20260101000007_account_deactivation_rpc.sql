-- Migration: Account Deactivation RPC
-- Provides an atomic transaction for soft-deletion, audit logging, and idempotency tracking.

CREATE OR REPLACE FUNCTION soft_delete_account_atomic(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_request_id TEXT,
    p_request_hash TEXT,
    p_operation TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_status idempotency_status_enum;
    v_existing_hash TEXT;
    v_existing_operation TEXT;
    v_response_status INT;
    v_response_body jsonb;
BEGIN
    -- 1. Reserve Idempotency
    INSERT INTO idempotency_records (user_id, idempotency_key, operation, request_hash, status, expires_at)
    VALUES (p_user_id, p_idempotency_key, p_operation, p_request_hash, 'processing', NOW() + INTERVAL '24 hours')
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING;

    IF NOT FOUND THEN
        -- Record exists, fetch its state
        SELECT status, request_hash, operation, response_status, response_body
        INTO v_reservation_status, v_existing_hash, v_existing_operation, v_response_status, v_response_body
        FROM idempotency_records
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

        IF v_existing_hash != p_request_hash OR v_existing_operation != p_operation THEN
            RETURN jsonb_build_object('status', 'conflict');
        END IF;

        IF v_reservation_status = 'completed' THEN
            RETURN jsonb_build_object('status', 'completed', 'response_status', v_response_status, 'response_body', v_response_body);
        END IF;

        IF v_reservation_status = 'failed' THEN
            RETURN jsonb_build_object('status', 'failed');
        END IF;

        RETURN jsonb_build_object('status', 'conflict', 'reason', 'concurrent_processing');
    END IF;

    -- 2. Execute Soft-Delete
    UPDATE users
    SET account_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_user_id;

    -- 3. Audit Log
    INSERT INTO audit_logs (actor_user_id, actor_type, action, resource_type, resource_id, metadata, request_id)
    VALUES (p_user_id, 'user', 'ACCOUNT_DEACTIVATED', 'user_profile', p_user_id, jsonb_build_object('result', 'deleted'), NULLIF(p_request_id, '')::uuid);

    -- 4. Complete Idempotency
    v_response_status := 200;
    v_response_body := jsonb_build_object('success', true, 'account', jsonb_build_object('status', 'deleted'));

    UPDATE idempotency_records
    SET status = 'completed', response_status = v_response_status, response_body = v_response_body, updated_at = NOW()
    WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

    RETURN jsonb_build_object('status', 'success', 'response_status', v_response_status, 'response_body', v_response_body);
END;
$$;
