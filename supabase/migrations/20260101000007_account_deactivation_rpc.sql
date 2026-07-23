-- Migration: Account Deactivation RPC
-- Provides a two-stage durable lifecycle for soft-deletion and session revocation.

-- 1. Preparation RPC
CREATE OR REPLACE FUNCTION public.prepare_soft_delete_account(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_request_id TEXT,
    p_request_hash TEXT,
    p_operation TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_reservation_status public.idempotency_status_enum;
    v_existing_hash TEXT;
    v_existing_operation TEXT;
    v_response_status INT;
    v_response_body jsonb;
    v_account_status TEXT;
BEGIN
    -- 1. Lock the user row to ensure the user exists and lock the state
    SELECT account_status INTO v_account_status
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'user_not_found');
    END IF;

    -- 2. Reserve Idempotency
    INSERT INTO public.idempotency_records (user_id, idempotency_key, operation, request_hash, status, expires_at)
    VALUES (p_user_id, p_idempotency_key, p_operation, p_request_hash, 'processing', NOW() + INTERVAL '24 hours')
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING;

    IF NOT FOUND THEN
        -- Record exists, fetch its state
        SELECT status, request_hash, operation, response_status, response_body
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
            SELECT account_status::text INTO v_account_status FROM public.users WHERE id = p_user_id;
            IF v_account_status = 'deleted' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
            END IF;
            RETURN jsonb_build_object('status', 'failed');
        END IF;

        -- If processing, it's either concurrent OR a safe retry resuming session revocation
        RETURN jsonb_build_object('status', 'processing', 'reason', 'session_revocation_required');
    END IF;

    -- At this point, we own the idempotency reservation.
    -- Check if the account was already deleted (by a DIFFERENT idempotency key, since we didn't hit conflict).
    IF v_account_status = 'deleted' THEN
        -- Revert our idempotency insertion to 'failed' because this is a 403 response
        UPDATE public.idempotency_records
        SET status = 'failed', updated_at = NOW()
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
    END IF;

    -- 3. Execute Soft-Delete
    UPDATE public.users
    SET account_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_user_id;

    -- 4. Audit Log
    INSERT INTO public.audit_logs (actor_user_id, actor_type, action, resource_type, resource_id, metadata, request_id)
    VALUES (p_user_id, 'user', 'ACCOUNT_DEACTIVATED', 'user_profile', p_user_id, jsonb_build_object('result', 'deleted'), NULLIF(p_request_id, '')::uuid);

    -- 5. Return Processing State to initiate external session revocation
    RETURN jsonb_build_object('status', 'processing', 'reason', 'session_revocation_required');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 2. Finalization RPC
CREATE OR REPLACE FUNCTION public.finalize_soft_delete_account(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_operation TEXT
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_response_status INT := 200;
    v_response_body jsonb := jsonb_build_object('success', true, 'account', jsonb_build_object('status', 'deleted'));
    v_record_status TEXT;
BEGIN
    UPDATE public.idempotency_records
    SET status = 'completed', response_status = v_response_status, response_body = v_response_body, updated_at = NOW()
    WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key AND status = 'processing';

    IF NOT FOUND THEN
        -- Check if it's already completed
        SELECT status::text INTO v_record_status
        FROM public.idempotency_records
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

        -- We don't really care about fetching the actual response here because it's guaranteed to be the static deletion response
        IF v_record_status IS DISTINCT FROM 'completed' THEN
             RETURN jsonb_build_object('status', 'failed', 'reason', 'record_not_processing_nor_completed');
        END IF;
    END IF;

    RETURN jsonb_build_object('status', 'completed', 'response_status', v_response_status, 'response_body', v_response_body);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT) TO service_role;
