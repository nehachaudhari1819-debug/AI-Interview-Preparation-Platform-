-- Migration 08: Finalize P3.5 Deletion Hardening
-- This forward migration applies the corrected audit trigger and two-stage RPCs
-- to environments that have already applied the old 06 and 07 migrations.

-- 1. Recreate the corrected audit trigger (from updated 06)
create or replace function private.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Allow ON DELETE SET NULL cascades from public.users
  if TG_OP = 'UPDATE' and old.actor_user_id is not null and new.actor_user_id is null then
    if old.id = new.id and old.actor_type = new.actor_type and old.action = new.action
       and old.resource_type = new.resource_type and old.resource_id is not distinct from new.resource_id
       and old.metadata = new.metadata and old.request_id is not distinct from new.request_id
       and old.ip_address is not distinct from new.ip_address and old.user_agent is not distinct from new.user_agent
       and old.created_at = new.created_at then
       return new;
    end if;
  end if;

  raise exception 'audit logs are immutable';
end;
$$;



-- 3. Recreate the two-stage RPCs (from updated 07)

CREATE OR REPLACE FUNCTION public.prepare_soft_delete_account(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_request_id TEXT,
    p_request_hash TEXT,
    p_operation TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_account_status TEXT;
    v_reservation_status TEXT;
    v_existing_hash TEXT;
    v_existing_operation TEXT;
    v_response_status INT;
    v_response_body JSONB;
BEGIN
    -- 1. Validate User Exists
    SELECT account_status::text INTO v_account_status
    FROM public.users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'failed', 'reason', 'user_not_found');
    END IF;

    -- 2. Reserve Idempotency FIRST (to correctly handle concurrent replays even if already deleted)
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
            IF v_account_status = 'deleted' THEN
                RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
            END IF;
            RETURN jsonb_build_object('status', 'failed');
        END IF;

        -- If processing, it's either concurrent OR a safe retry resuming session revocation
        RETURN jsonb_build_object('status', 'processing', 'reason', 'session_revocation_required');
    END IF;

    -- 3. Now check if account was ALREADY deleted (since this is a brand new request/idempotency key)
    IF v_account_status = 'deleted' THEN
        -- Fail the freshly reserved record since account is already deleted
        UPDATE public.idempotency_records
        SET status = 'failed'
        WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

        RETURN jsonb_build_object('status', 'failed', 'reason', 'account_already_deleted');
    END IF;

    -- 4. Return processing to indicate lock acquired
    RETURN jsonb_build_object('status', 'processing');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT, TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_soft_delete_account(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;


CREATE OR REPLACE FUNCTION public.finalize_soft_delete_account(
    p_user_id UUID,
    p_idempotency_key TEXT,
    p_operation TEXT,
    p_request_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record_status TEXT;
    v_response_status INT;
    v_response_body JSONB;
BEGIN
    -- 1. Verify idempotency lock
    SELECT status::text INTO v_record_status
    FROM public.idempotency_records
    WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF v_record_status IS DISTINCT FROM 'processing' THEN
        -- Might have been completed concurrently, handle gracefully
        IF v_record_status = 'completed' THEN
            SELECT response_status, response_body INTO v_response_status, v_response_body
            FROM public.idempotency_records
            WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;
            
            RETURN jsonb_build_object('status', 'completed', 'response_status', v_response_status, 'response_body', v_response_body);
        END IF;

        RETURN jsonb_build_object('status', 'failed', 'reason', 'record_not_processing');
    END IF;

    -- 2. Perform the actual deletion
    UPDATE public.users
    SET account_status = 'deleted', deleted_at = NOW(), updated_at = NOW()
    WHERE id = p_user_id;

    -- 3. Audit Log
    INSERT INTO public.audit_logs (actor_user_id, actor_type, action, resource_type, resource_id, metadata, request_id)
    VALUES (p_user_id, 'user', 'ACCOUNT_DEACTIVATED', 'user_profile', p_user_id, jsonb_build_object('result', 'deleted'), p_request_id);

    -- 4. Finalize idempotency record
    v_response_status := 200;
    v_response_body := jsonb_build_object('success', true, 'account', jsonb_build_object('status', 'deleted'));

    UPDATE public.idempotency_records
    SET status = 'completed',
        response_status = v_response_status,
        response_body = v_response_body
    WHERE user_id = p_user_id AND operation = p_operation AND idempotency_key = p_idempotency_key;

    IF NOT FOUND THEN
        -- In case something weird happened
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

REVOKE EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_soft_delete_account(UUID, TEXT, TEXT, UUID) TO service_role;

-- Drop the old single-stage RPC (if it exists from the old 07)
DROP FUNCTION IF EXISTS public.soft_delete_account_atomic(UUID);
