-- Migration 14: Phase 3.7 Audit and Idempotency Integration

-- 1. Add Lease Fields to Idempotency Records
ALTER TABLE public.idempotency_records
ADD COLUMN IF NOT EXISTS lease_token UUID DEFAULT NULL,
ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;

-- Ensure RLS is still properly set and backend-system access only is enforced
-- (Already handled by previous migrations, but good to be explicit for new columns implicitly)

-- 2. Audit Trigger for PROFILE_UPDATED
CREATE OR REPLACE FUNCTION private.audit_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_changed_fields text[];
    v_actor_id uuid;
    v_actor_type text;
BEGIN
    v_changed_fields := ARRAY[]::text[];

    IF NEW.full_name IS DISTINCT FROM OLD.full_name THEN
        v_changed_fields := array_append(v_changed_fields, 'full_name');
    END IF;
    IF NEW.college IS DISTINCT FROM OLD.college THEN
        v_changed_fields := array_append(v_changed_fields, 'college');
    END IF;
    IF NEW.branch IS DISTINCT FROM OLD.branch THEN
        v_changed_fields := array_append(v_changed_fields, 'branch');
    END IF;
    IF NEW.graduation_year IS DISTINCT FROM OLD.graduation_year THEN
        v_changed_fields := array_append(v_changed_fields, 'graduation_year');
    END IF;
    IF NEW.experience_level IS DISTINCT FROM OLD.experience_level THEN
        v_changed_fields := array_append(v_changed_fields, 'experience_level');
    END IF;
    IF NEW.preferred_roles IS DISTINCT FROM OLD.preferred_roles THEN
        v_changed_fields := array_append(v_changed_fields, 'preferred_roles');
    END IF;
    IF NEW.bio IS DISTINCT FROM OLD.bio THEN
        v_changed_fields := array_append(v_changed_fields, 'bio');
    END IF;
    IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url THEN
        v_changed_fields := array_append(v_changed_fields, 'avatar_url');
    END IF;

    -- If no approved fields changed, do not audit
    IF array_length(v_changed_fields, 1) IS NULL THEN
        RETURN NEW;
    END IF;

    -- Sort the array
    SELECT array_agg(f ORDER BY f) INTO v_changed_fields
    FROM unnest(v_changed_fields) AS f;

    -- Determine actor
    v_actor_id := auth.uid();
    IF v_actor_id IS NOT NULL THEN
        v_actor_type := 'user';
    ELSE
        -- Fallback if an admin or system updates it directly
        v_actor_type := 'system';
    END IF;

    INSERT INTO public.audit_logs (
        actor_user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        metadata
    ) VALUES (
        v_actor_id,
        v_actor_type,
        'PROFILE_UPDATED',
        'user_profile',
        NEW.id,
        jsonb_build_object('changedFields', to_jsonb(v_changed_fields))
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_user_profile_update_trigger ON public.users;
CREATE TRIGGER audit_user_profile_update_trigger
AFTER UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION private.audit_user_profile_update();

-- Revoke public execution
REVOKE EXECUTE ON FUNCTION private.audit_user_profile_update() FROM public, anon, authenticated;

-- 3. Atomic Idempotency RPCs

CREATE OR REPLACE FUNCTION public.acquire_idempotency_lease(
    p_user_id UUID,
    p_operation TEXT,
    p_idempotency_key TEXT,
    p_request_hash TEXT,
    p_lease_duration_sec INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record public.idempotency_records%ROWTYPE;
    v_now TIMESTAMPTZ := NOW();
    v_new_lease_token UUID := gen_random_uuid();
    v_new_lease_expires_at TIMESTAMPTZ := v_now + (p_lease_duration_sec || ' seconds')::INTERVAL;
BEGIN
    -- 1. Try to insert first to handle pure race condition on new keys
    INSERT INTO public.idempotency_records (
        user_id,
        operation,
        idempotency_key,
        request_hash,
        status,
        lease_token,
        lease_expires_at,
        attempt_count,
        expires_at
    ) VALUES (
        p_user_id,
        p_operation,
        p_idempotency_key,
        p_request_hash,
        'processing',
        v_new_lease_token,
        v_new_lease_expires_at,
        1,
        v_now + INTERVAL '24 hours'
    )
    ON CONFLICT (user_id, operation, idempotency_key) DO NOTHING
    RETURNING * INTO v_record;

    IF v_record.id IS NOT NULL THEN
        -- We won the race and inserted it
        RETURN jsonb_build_object(
            'status', 'acquired',
            'lease_token', v_record.lease_token,
            'lease_expires_at', v_record.lease_expires_at,
            'record_id', v_record.id
        );
    END IF;

    -- 2. If we get here, the row already exists. Let's lock it.
    SELECT * INTO v_record
    FROM public.idempotency_records
    WHERE user_id = p_user_id
      AND operation = p_operation
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Should not happen unless deleted concurrently
        RETURN jsonb_build_object('status', 'unavailable');
    END IF;

    -- 3. Check for conflict
    IF v_record.request_hash != p_request_hash THEN
        RETURN jsonb_build_object('status', 'conflict');
    END IF;

    -- 4. Check completed
    IF v_record.status = 'completed' THEN
        IF v_record.expires_at < v_now THEN
            -- Reclaim expired completed record
            UPDATE public.idempotency_records
            SET status = 'processing',
                lease_token = v_new_lease_token,
                lease_expires_at = v_new_lease_expires_at,
                attempt_count = 1,
                expires_at = v_now + INTERVAL '24 hours',
                response_body = NULL,
                response_status = NULL,
                updated_at = v_now
            WHERE id = v_record.id
            RETURNING * INTO v_record;

            RETURN jsonb_build_object(
                'status', 'acquired',
                'lease_token', v_record.lease_token,
                'lease_expires_at', v_record.lease_expires_at,
                'record_id', v_record.id
            );
        END IF;

        RETURN jsonb_build_object(
            'status', 'replay',
            'response_status', v_record.response_status,
            'response_body', v_record.response_body
        );
    END IF;

    -- 5. Check failed
    IF v_record.status = 'failed' THEN
        -- Retryable, so reclaim
        UPDATE public.idempotency_records
        SET status = 'processing',
            lease_token = v_new_lease_token,
            lease_expires_at = v_new_lease_expires_at,
            attempt_count = COALESCE(attempt_count, 0) + 1,
            updated_at = v_now
        WHERE id = v_record.id
        RETURNING * INTO v_record;

        RETURN jsonb_build_object(
            'status', 'acquired',
            'lease_token', v_record.lease_token,
            'lease_expires_at', v_record.lease_expires_at,
            'record_id', v_record.id
        );
    END IF;

    -- 6. Processing status
    IF v_record.status = 'processing' THEN
        IF v_record.lease_expires_at > v_now THEN
            -- Lease still valid
            RETURN jsonb_build_object('status', 'in_progress');
        ELSE
            -- Lease expired, reclaim
            UPDATE public.idempotency_records
            SET lease_token = v_new_lease_token,
                lease_expires_at = v_new_lease_expires_at,
                attempt_count = COALESCE(attempt_count, 0) + 1,
                updated_at = v_now
            WHERE id = v_record.id
            RETURNING * INTO v_record;

            RETURN jsonb_build_object(
                'status', 'acquired',
                'lease_token', v_record.lease_token,
                'lease_expires_at', v_record.lease_expires_at,
                'record_id', v_record.id
            );
        END IF;
    END IF;

    RETURN jsonb_build_object('status', 'unavailable');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acquire_idempotency_lease(UUID, TEXT, TEXT, TEXT, INT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_idempotency_lease(UUID, TEXT, TEXT, TEXT, INT) TO service_role;


CREATE OR REPLACE FUNCTION public.complete_idempotency_lease(
    p_record_id UUID,
    p_lease_token UUID,
    p_response_status INT,
    p_response_body JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record public.idempotency_records%ROWTYPE;
BEGIN
    SELECT * INTO v_record
    FROM public.idempotency_records
    WHERE id = p_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_record.status != 'processing' THEN
        RETURN FALSE;
    END IF;

    IF v_record.lease_token IS DISTINCT FROM p_lease_token THEN
        RETURN FALSE;
    END IF;

    UPDATE public.idempotency_records
    SET status = 'completed',
        response_status = p_response_status,
        response_body = p_response_body,
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = NOW()
    WHERE id = p_record_id;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_idempotency_lease(UUID, UUID, INT, JSONB) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_idempotency_lease(UUID, UUID, INT, JSONB) TO service_role;


CREATE OR REPLACE FUNCTION public.fail_idempotency_lease(
    p_record_id UUID,
    p_lease_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_record public.idempotency_records%ROWTYPE;
BEGIN
    SELECT * INTO v_record
    FROM public.idempotency_records
    WHERE id = p_record_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_record.status != 'processing' THEN
        RETURN FALSE;
    END IF;

    IF v_record.lease_token IS DISTINCT FROM p_lease_token THEN
        RETURN FALSE;
    END IF;

    UPDATE public.idempotency_records
    SET status = 'failed',
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = NOW()
    WHERE id = p_record_id;

    RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fail_idempotency_lease(UUID, UUID) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_idempotency_lease(UUID, UUID) TO service_role;
