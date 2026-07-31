-- Migration 23: Phase 5.4 Interview Session Lifecycle RPC
-- Creates the atomic lifecycle state machine and idempotent RPC wrappers.

-- 1. Create clock_timestamp() trigger function for interview_sessions
CREATE OR REPLACE FUNCTION private.set_updated_at_clock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.*) IS NOT DISTINCT FROM ROW(OLD.*) THEN
      RETURN OLD;
  END IF;
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

-- Replace the existing trigger on interview_sessions only
DROP TRIGGER IF EXISTS set_interview_sessions_updated_at ON public.interview_sessions;

CREATE TRIGGER set_interview_sessions_updated_at
BEFORE UPDATE ON public.interview_sessions
FOR EACH ROW
EXECUTE FUNCTION private.set_updated_at_clock();

-- Secure the new clock function
REVOKE ALL ON FUNCTION private.set_updated_at_clock() FROM PUBLIC, anon, authenticated;


-- 2. Authoritative Lifecycle Engine
CREATE OR REPLACE FUNCTION private.transition_interview_session_lifecycle(
    p_interview_id UUID,
    p_session_id UUID,
    p_operation TEXT,
    p_idempotency_key TEXT,
    p_request_hash TEXT,
    p_required_source_state TEXT,
    p_target_state TEXT,
    p_audit_action TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_lock_key BIGINT;
    v_acquire_result JSONB;
    v_status TEXT;
    v_record_id UUID;
    v_lease_token UUID;
    v_existing_type TEXT;
    v_existing_id UUID;
    v_row_count INT;
    v_session public.interview_sessions%ROWTYPE;
    v_transition_at TIMESTAMPTZ;
    v_pause_seconds INT;
    v_snapshot JSONB;
    v_completion_succeeded BOOLEAN;
BEGIN
    -- 1. Identity validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Advisory Lock for strict concurrency rejection
    v_lock_key := hashtextextended(jsonb_build_array(v_user_id::text, p_operation, p_idempotency_key)::text, 0);
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0003';
    END IF;

    -- 3. Idempotency Acquisition
    v_acquire_result := public.acquire_idempotency_lease(
        v_user_id, p_operation, p_idempotency_key, p_request_hash, 60
    );

    v_status := v_acquire_result->>'status';
    IF v_status = 'conflict' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0003';
    ELSIF v_status = 'in_progress' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0003';
    ELSIF v_status = 'replay' THEN
        IF v_acquire_result->>'response_status' IS NULL OR v_acquire_result->>'response_body' IS NULL THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;
        RETURN jsonb_build_object(
            'replayed', true,
            'response_status', (v_acquire_result->>'response_status')::int,
            'snapshot', v_acquire_result->'response_body'
        );
    ELSIF v_status = 'unavailable' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    ELSIF v_status != 'acquired' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    v_record_id := (v_acquire_result->>'record_id')::uuid;
    v_lease_token := (v_acquire_result->>'lease_token')::uuid;

    IF v_record_id IS NULL OR v_lease_token IS NULL THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 4. Resource Binding
    SELECT resource_type, resource_id INTO v_existing_type, v_existing_id
    FROM public.idempotency_records
    WHERE id = v_record_id;

    IF (v_existing_type IS NOT NULL AND v_existing_type != 'interview_session') OR
       (v_existing_id IS NOT NULL AND v_existing_id != p_session_id) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.idempotency_records
    SET resource_type = 'interview_session',
        resource_id = p_session_id
    WHERE id = v_record_id
      AND lease_token = v_lease_token
      AND status = 'processing';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 5. Session Row Lock
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = p_session_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 6. State Validation
    IF v_session.status::text != p_required_source_state THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- 7. Timestamp & Transition
    v_transition_at := clock_timestamp();

    IF p_operation = 'interview_session.start' THEN
        UPDATE public.interview_sessions
        SET status = p_target_state::public.interview_session_status_enum,
            started_at = v_transition_at,
            paused_at = NULL,
            completed_at = NULL,
            last_transition_at = v_transition_at
        WHERE id = p_session_id
        RETURNING * INTO v_session;

    ELSIF p_operation = 'interview_session.pause' THEN
        UPDATE public.interview_sessions
        SET status = p_target_state::public.interview_session_status_enum,
            paused_at = v_transition_at,
            last_transition_at = v_transition_at
        WHERE id = p_session_id
        RETURNING * INTO v_session;

    ELSIF p_operation = 'interview_session.resume' THEN
        IF v_session.paused_at IS NULL OR v_transition_at < v_session.paused_at THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;

        v_pause_seconds := floor(extract(epoch from (v_transition_at - v_session.paused_at)))::integer;
        IF v_pause_seconds < 0 THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;

        UPDATE public.interview_sessions
        SET status = p_target_state::public.interview_session_status_enum,
            total_paused_seconds = total_paused_seconds + v_pause_seconds,
            paused_at = NULL,
            last_transition_at = v_transition_at
        WHERE id = p_session_id
        RETURNING * INTO v_session;

    ELSIF p_operation = 'interview_session.complete' THEN
        UPDATE public.interview_sessions
        SET status = p_target_state::public.interview_session_status_enum,
            completed_at = v_transition_at,
            paused_at = NULL,
            last_transition_at = v_transition_at
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    ELSE
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 8. Audit Insertion
    INSERT INTO public.audit_logs (
        actor_user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        created_at,
        metadata
    ) VALUES (
        v_user_id,
        'user',
        p_audit_action,
        'interview_session',
        p_session_id,
        v_transition_at,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'previous_state', p_required_source_state,
            'new_state', p_target_state,
            'operation', p_operation,
            'idempotency_record_id', v_record_id
        )
    );

    -- 9. Complete Idempotency Lease
    v_snapshot := row_to_json(v_session)::jsonb;
    v_completion_succeeded := public.complete_idempotency_lease(
        v_record_id,
        v_lease_token,
        200,
        v_snapshot
    );

    IF v_completion_succeeded IS NOT TRUE THEN
        RAISE EXCEPTION 'IDEMPOTENCY_COMPLETION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 10. Return Envelope
    RETURN jsonb_build_object(
        'replayed', false,
        'response_status', 200,
        'snapshot', v_snapshot
    );
END;
$$;

ALTER FUNCTION private.transition_interview_session_lifecycle OWNER TO postgres;
REVOKE ALL ON FUNCTION private.transition_interview_session_lifecycle FROM PUBLIC, anon, authenticated, service_role;


-- 3. Thin Public Wrappers

CREATE OR REPLACE FUNCTION public.student_start_interview_session(
    p_interview_id UUID,
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_request_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.transition_interview_session_lifecycle(
        p_interview_id, p_session_id, 'interview_session.start', p_idempotency_key, p_request_hash, 'ready', 'in_progress', 'INTERVIEW_SESSION_STARTED'
    );
END;
$$;

ALTER FUNCTION public.student_start_interview_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_start_interview_session FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_start_interview_session TO authenticated;


CREATE OR REPLACE FUNCTION public.student_pause_interview_session(
    p_interview_id UUID,
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_request_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.transition_interview_session_lifecycle(
        p_interview_id, p_session_id, 'interview_session.pause', p_idempotency_key, p_request_hash, 'in_progress', 'paused', 'INTERVIEW_SESSION_PAUSED'
    );
END;
$$;

ALTER FUNCTION public.student_pause_interview_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_pause_interview_session FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_pause_interview_session TO authenticated;


CREATE OR REPLACE FUNCTION public.student_resume_interview_session(
    p_interview_id UUID,
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_request_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.transition_interview_session_lifecycle(
        p_interview_id, p_session_id, 'interview_session.resume', p_idempotency_key, p_request_hash, 'paused', 'in_progress', 'INTERVIEW_SESSION_RESUMED'
    );
END;
$$;

ALTER FUNCTION public.student_resume_interview_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_resume_interview_session FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_resume_interview_session TO authenticated;


CREATE OR REPLACE FUNCTION public.student_complete_interview_session(
    p_interview_id UUID,
    p_session_id UUID,
    p_idempotency_key TEXT,
    p_request_hash TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN private.transition_interview_session_lifecycle(
        p_interview_id, p_session_id, 'interview_session.complete', p_idempotency_key, p_request_hash, 'in_progress', 'completed', 'INTERVIEW_SESSION_COMPLETED'
    );
END;
$$;

ALTER FUNCTION public.student_complete_interview_session OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_complete_interview_session FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_complete_interview_session TO authenticated;
