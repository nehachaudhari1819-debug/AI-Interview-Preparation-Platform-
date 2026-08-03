-- Migration 26: Phase 6.3 Interview Answer Mutation and Session Completion APIs
-- Implements canonical write RPCs for answer lifecycle and extends session completion
-- to atomically finalize drafts, skip unanswered questions, and initialize evaluations.

-- ============================================================
-- 1. ANSWER MUTATION HELPERS
-- ============================================================

-- Helper: validate session ownership and in_progress state (with lock)
-- Returns the locked session row or raises appropriate errors.
-- Used by all answer mutation RPCs.

-- ============================================================
-- 2. SAVE DRAFT ANSWER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.student_save_draft_answer(
    p_interview_id        uuid,
    p_session_id          uuid,
    p_session_question_id uuid,
    p_response_type       text,
    p_text_response       text,
    p_code_response       jsonb,
    p_idempotency_key     text,
    p_request_hash        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id            uuid := auth.uid();
    v_operation constant text := 'ANSWER_SAVE_DRAFT';
    v_lock_key           bigint;
    v_acquire_result     jsonb;
    v_acquire_status     text;
    v_record_id          uuid;
    v_lease_token        uuid;
    v_existing_type      text;
    v_existing_id        uuid;
    v_row_count          int;
    v_session            public.interview_sessions%ROWTYPE;
    v_answer             public.interview_session_answers%ROWTYPE;
    v_ts                 timestamptz;
    v_snapshot           jsonb;
    v_completion_ok      boolean;
BEGIN
    -- 1. Identity and active-account validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;
    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Advisory transaction lock
    v_lock_key := hashtextextended(
        jsonb_build_array(v_user_id::text, v_operation, p_idempotency_key)::text, 0
    );
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    END IF;

    -- 3. Idempotency acquisition
    v_acquire_result := public.acquire_idempotency_lease(
        v_user_id, v_operation, p_idempotency_key, p_request_hash, 60
    );
    v_acquire_status := v_acquire_result->>'status';

    IF v_acquire_status = 'conflict' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    ELSIF v_acquire_status = 'in_progress' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    ELSIF v_acquire_status = 'replay' THEN
        IF v_acquire_result->>'response_status' IS NULL OR v_acquire_result->>'response_body' IS NULL THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;
        RETURN jsonb_build_object(
            'replayed', true,
            'response_status', (v_acquire_result->>'response_status')::int,
            'snapshot', v_acquire_result->'response_body'
        );
    ELSIF v_acquire_status = 'unavailable' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    ELSIF v_acquire_status != 'acquired' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    v_record_id   := (v_acquire_result->>'record_id')::uuid;
    v_lease_token := (v_acquire_result->>'lease_token')::uuid;
    IF v_record_id IS NULL OR v_lease_token IS NULL THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 4. Resource binding (bind to interview_session_answer / session_question_id)
    SELECT resource_type, resource_id INTO v_existing_type, v_existing_id
    FROM public.idempotency_records WHERE id = v_record_id;

    IF (v_existing_type IS NOT NULL AND v_existing_type != 'interview_session_answer') OR
       (v_existing_id IS NOT NULL AND v_existing_id != p_session_question_id) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    END IF;

    UPDATE public.idempotency_records
    SET resource_type = 'interview_session_answer',
        resource_id   = p_session_question_id
    WHERE id = v_record_id AND lease_token = v_lease_token AND status = 'processing';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 5. Lock session row (ownership + in_progress check)
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = p_session_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_session.status::text != 'in_progress' THEN
        RAISE EXCEPTION 'SESSION_TERMINAL' USING ERRCODE = 'P0011';
    END IF;

    -- 6. Lock session question to confirm ownership
    PERFORM 1
    FROM public.interview_session_questions
    WHERE id = p_session_question_id AND session_id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 7. Check no answer already exists for this question
    SELECT * INTO v_answer
    FROM public.interview_session_answers
    WHERE session_id = p_session_id AND session_question_id = p_session_question_id
    FOR UPDATE;

    IF FOUND THEN
        -- Answer already exists — duplicate creation attempt
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- 8. Authoritative timestamp
    v_ts := pg_catalog.clock_timestamp();

    -- 9. Insert draft answer (version=1 enforced by trigger)
    INSERT INTO public.interview_session_answers (
        user_id, interview_id, session_id, session_question_id,
        response_type, text_response, code_response,
        status, version, finalized_at, skipped_at, created_at, updated_at
    ) VALUES (
        v_user_id, p_interview_id, p_session_id, p_session_question_id,
        p_response_type, p_text_response, p_code_response,
        'draft', 1, NULL, NULL, v_ts, v_ts
    )
    RETURNING * INTO v_answer;

    -- 10. Audit record
    INSERT INTO public.audit_logs (
        actor_user_id, actor_type, action,
        resource_type, resource_id, created_at, metadata
    ) VALUES (
        v_user_id, 'user', 'ANSWER_DRAFT_CREATED',
        'interview_session_answer', v_answer.id, v_ts,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'session_question_id', p_session_question_id,
            'response_type', p_response_type,
            'version', 1,
            'idempotency_record_id', v_record_id
        )
    );

    -- 11. Build snapshot
    v_snapshot := jsonb_build_object(
        'id',                   v_answer.id,
        'sessionQuestionId',    v_answer.session_question_id,
        'responseType',         v_answer.response_type,
        'textResponse',         v_answer.text_response,
        'codeResponse',         v_answer.code_response,
        'status',               v_answer.status,
        'version',              v_answer.version,
        'finalizedAt',          v_answer.finalized_at,
        'skippedAt',            v_answer.skipped_at,
        'createdAt',            v_answer.created_at,
        'updatedAt',            v_answer.updated_at
    );

    -- 12. Complete idempotency lease
    v_completion_ok := public.complete_idempotency_lease(v_record_id, v_lease_token, 201, v_snapshot);
    IF v_completion_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    RETURN jsonb_build_object(
        'replayed',        false,
        'response_status', 201,
        'snapshot',        v_snapshot
    );
END;
$$;

ALTER FUNCTION public.student_save_draft_answer(uuid,uuid,uuid,text,text,jsonb,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_save_draft_answer(uuid,uuid,uuid,text,text,jsonb,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_save_draft_answer(uuid,uuid,uuid,text,text,jsonb,text,text) TO authenticated;


-- ============================================================
-- 3. UPDATE DRAFT ANSWER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.student_update_draft_answer(
    p_interview_id        uuid,
    p_session_id          uuid,
    p_session_question_id uuid,
    p_expected_version    integer,
    p_text_response       text,
    p_code_response       jsonb,
    p_idempotency_key     text,
    p_request_hash        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id            uuid := auth.uid();
    v_operation constant text := 'ANSWER_UPDATE_DRAFT';
    v_lock_key           bigint;
    v_acquire_result     jsonb;
    v_acquire_status     text;
    v_record_id          uuid;
    v_lease_token        uuid;
    v_existing_type      text;
    v_existing_id        uuid;
    v_row_count          int;
    v_session            public.interview_sessions%ROWTYPE;
    v_answer             public.interview_session_answers%ROWTYPE;
    v_ts                 timestamptz;
    v_snapshot           jsonb;
    v_completion_ok      boolean;
BEGIN
    -- 1. Identity and active-account validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;
    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Advisory transaction lock
    v_lock_key := hashtextextended(
        jsonb_build_array(v_user_id::text, v_operation, p_idempotency_key)::text, 0
    );
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    END IF;

    -- 3. Idempotency acquisition
    v_acquire_result := public.acquire_idempotency_lease(
        v_user_id, v_operation, p_idempotency_key, p_request_hash, 60
    );
    v_acquire_status := v_acquire_result->>'status';

    IF v_acquire_status = 'conflict' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    ELSIF v_acquire_status = 'in_progress' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    ELSIF v_acquire_status = 'replay' THEN
        IF v_acquire_result->>'response_status' IS NULL OR v_acquire_result->>'response_body' IS NULL THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;
        RETURN jsonb_build_object(
            'replayed', true,
            'response_status', (v_acquire_result->>'response_status')::int,
            'snapshot', v_acquire_result->'response_body'
        );
    ELSIF v_acquire_status = 'unavailable' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    ELSIF v_acquire_status != 'acquired' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    v_record_id   := (v_acquire_result->>'record_id')::uuid;
    v_lease_token := (v_acquire_result->>'lease_token')::uuid;
    IF v_record_id IS NULL OR v_lease_token IS NULL THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 4. Resource binding
    SELECT resource_type, resource_id INTO v_existing_type, v_existing_id
    FROM public.idempotency_records WHERE id = v_record_id;

    IF (v_existing_type IS NOT NULL AND v_existing_type != 'interview_session_answer') OR
       (v_existing_id IS NOT NULL AND v_existing_id != p_session_question_id) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    END IF;

    UPDATE public.idempotency_records
    SET resource_type = 'interview_session_answer',
        resource_id   = p_session_question_id
    WHERE id = v_record_id AND lease_token = v_lease_token AND status = 'processing';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 5. Lock session row
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = p_session_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_session.status::text != 'in_progress' THEN
        RAISE EXCEPTION 'SESSION_TERMINAL' USING ERRCODE = 'P0011';
    END IF;

    -- 6. Lock answer row
    SELECT * INTO v_answer
    FROM public.interview_session_answers
    WHERE session_id = p_session_id
      AND session_question_id = p_session_question_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 7. State and CAS checks (raise before trigger fires for precise codes)
    IF v_answer.status = 'skipped' THEN
        RAISE EXCEPTION 'ANSWER_SKIPPED' USING ERRCODE = 'P0014';
    END IF;
    IF v_answer.status = 'finalized' THEN
        RAISE EXCEPTION 'ANSWER_IMMUTABLE' USING ERRCODE = 'P0013';
    END IF;
    IF v_answer.version IS DISTINCT FROM p_expected_version THEN
        RAISE EXCEPTION 'STALE_UPDATE_CONFLICT' USING ERRCODE = 'P0012';
    END IF;

    -- 8. Authoritative timestamp
    v_ts := pg_catalog.clock_timestamp();

    -- 9. Update draft (trigger enforces version increment, immutable fields, session state)
    UPDATE public.interview_session_answers
    SET text_response = p_text_response,
        code_response = p_code_response,
        version       = v_answer.version + 1
    WHERE id = v_answer.id
    RETURNING * INTO v_answer;

    -- 10. Audit
    INSERT INTO public.audit_logs (
        actor_user_id, actor_type, action,
        resource_type, resource_id, created_at, metadata
    ) VALUES (
        v_user_id, 'user', 'ANSWER_DRAFT_UPDATED',
        'interview_session_answer', v_answer.id, v_ts,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'session_question_id', p_session_question_id,
            'version', v_answer.version,
            'idempotency_record_id', v_record_id
        )
    );

    -- 11. Build snapshot
    v_snapshot := jsonb_build_object(
        'id',                   v_answer.id,
        'sessionQuestionId',    v_answer.session_question_id,
        'responseType',         v_answer.response_type,
        'textResponse',         v_answer.text_response,
        'codeResponse',         v_answer.code_response,
        'status',               v_answer.status,
        'version',              v_answer.version,
        'finalizedAt',          v_answer.finalized_at,
        'skippedAt',            v_answer.skipped_at,
        'createdAt',            v_answer.created_at,
        'updatedAt',            v_answer.updated_at
    );

    -- 12. Complete idempotency lease
    v_completion_ok := public.complete_idempotency_lease(v_record_id, v_lease_token, 200, v_snapshot);
    IF v_completion_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    RETURN jsonb_build_object(
        'replayed',        false,
        'response_status', 200,
        'snapshot',        v_snapshot
    );
END;
$$;

ALTER FUNCTION public.student_update_draft_answer(uuid,uuid,uuid,integer,text,jsonb,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_update_draft_answer(uuid,uuid,uuid,integer,text,jsonb,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_update_draft_answer(uuid,uuid,uuid,integer,text,jsonb,text,text) TO authenticated;


-- ============================================================
-- 4. FINALIZE ANSWER RPC
-- ============================================================

CREATE OR REPLACE FUNCTION public.student_finalize_answer(
    p_interview_id        uuid,
    p_session_id          uuid,
    p_session_question_id uuid,
    p_expected_version    integer,
    p_idempotency_key     text,
    p_request_hash        text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id            uuid := auth.uid();
    v_operation constant text := 'ANSWER_FINALIZE';
    v_lock_key           bigint;
    v_acquire_result     jsonb;
    v_acquire_status     text;
    v_record_id          uuid;
    v_lease_token        uuid;
    v_existing_type      text;
    v_existing_id        uuid;
    v_row_count          int;
    v_session            public.interview_sessions%ROWTYPE;
    v_answer             public.interview_session_answers%ROWTYPE;
    v_ts                 timestamptz;
    v_snapshot           jsonb;
    v_completion_ok      boolean;
BEGIN
    -- 1. Identity and active-account validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;
    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Advisory transaction lock
    v_lock_key := hashtextextended(
        jsonb_build_array(v_user_id::text, v_operation, p_idempotency_key)::text, 0
    );
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    END IF;

    -- 3. Idempotency acquisition
    v_acquire_result := public.acquire_idempotency_lease(
        v_user_id, v_operation, p_idempotency_key, p_request_hash, 60
    );
    v_acquire_status := v_acquire_result->>'status';

    IF v_acquire_status = 'conflict' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    ELSIF v_acquire_status = 'in_progress' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    ELSIF v_acquire_status = 'replay' THEN
        IF v_acquire_result->>'response_status' IS NULL OR v_acquire_result->>'response_body' IS NULL THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;
        RETURN jsonb_build_object(
            'replayed', true,
            'response_status', (v_acquire_result->>'response_status')::int,
            'snapshot', v_acquire_result->'response_body'
        );
    ELSIF v_acquire_status = 'unavailable' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    ELSIF v_acquire_status != 'acquired' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    v_record_id   := (v_acquire_result->>'record_id')::uuid;
    v_lease_token := (v_acquire_result->>'lease_token')::uuid;
    IF v_record_id IS NULL OR v_lease_token IS NULL THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 4. Resource binding
    SELECT resource_type, resource_id INTO v_existing_type, v_existing_id
    FROM public.idempotency_records WHERE id = v_record_id;

    IF (v_existing_type IS NOT NULL AND v_existing_type != 'interview_session_answer') OR
       (v_existing_id IS NOT NULL AND v_existing_id != p_session_question_id) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    END IF;

    UPDATE public.idempotency_records
    SET resource_type = 'interview_session_answer',
        resource_id   = p_session_question_id
    WHERE id = v_record_id AND lease_token = v_lease_token AND status = 'processing';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 5. Lock session row
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = p_session_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_session.status::text != 'in_progress' THEN
        RAISE EXCEPTION 'SESSION_TERMINAL' USING ERRCODE = 'P0011';
    END IF;

    -- 6. Lock answer row
    SELECT * INTO v_answer
    FROM public.interview_session_answers
    WHERE session_id = p_session_id
      AND session_question_id = p_session_question_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    -- 7. State and CAS checks
    IF v_answer.status = 'skipped' THEN
        RAISE EXCEPTION 'ANSWER_SKIPPED' USING ERRCODE = 'P0014';
    END IF;
    IF v_answer.status = 'finalized' THEN
        RAISE EXCEPTION 'ANSWER_IMMUTABLE' USING ERRCODE = 'P0013';
    END IF;
    IF v_answer.version IS DISTINCT FROM p_expected_version THEN
        RAISE EXCEPTION 'STALE_UPDATE_CONFLICT' USING ERRCODE = 'P0012';
    END IF;

    -- 8. Authoritative timestamp
    v_ts := pg_catalog.clock_timestamp();

    -- 9. Finalize answer (trigger enforces version+1, state machine, immutable fields)
    UPDATE public.interview_session_answers
    SET status       = 'finalized',
        finalized_at = v_ts,
        version      = v_answer.version + 1
    WHERE id = v_answer.id
    RETURNING * INTO v_answer;

    -- 10. Audit
    INSERT INTO public.audit_logs (
        actor_user_id, actor_type, action,
        resource_type, resource_id, created_at, metadata
    ) VALUES (
        v_user_id, 'user', 'ANSWER_FINALIZED',
        'interview_session_answer', v_answer.id, v_ts,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'session_question_id', p_session_question_id,
            'version', v_answer.version,
            'idempotency_record_id', v_record_id
        )
    );

    -- 11. Build snapshot
    v_snapshot := jsonb_build_object(
        'id',                   v_answer.id,
        'sessionQuestionId',    v_answer.session_question_id,
        'responseType',         v_answer.response_type,
        'textResponse',         v_answer.text_response,
        'codeResponse',         v_answer.code_response,
        'status',               v_answer.status,
        'version',              v_answer.version,
        'finalizedAt',          v_answer.finalized_at,
        'skippedAt',            v_answer.skipped_at,
        'createdAt',            v_answer.created_at,
        'updatedAt',            v_answer.updated_at
    );

    -- 12. Complete idempotency lease
    v_completion_ok := public.complete_idempotency_lease(v_record_id, v_lease_token, 200, v_snapshot);
    IF v_completion_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    RETURN jsonb_build_object(
        'replayed',        false,
        'response_status', 200,
        'snapshot',        v_snapshot
    );
END;
$$;

ALTER FUNCTION public.student_finalize_answer(uuid,uuid,uuid,integer,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_finalize_answer(uuid,uuid,uuid,integer,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_finalize_answer(uuid,uuid,uuid,integer,text,text) TO authenticated;


-- ============================================================
-- 5. ATOMIC SESSION COMPLETION — REPLACE EXISTING RPC
--    Preserves exact public signature from Migration 23.
--    Extends behavior to:
--      - finalize all draft answers
--      - skip unanswered questions
--      - insert pending/skipped evaluations
--      - insert one pending session result
--    All writes happen BEFORE the session status transition
--    to satisfy Migration 25 trigger (requires session = in_progress).
-- ============================================================

CREATE OR REPLACE FUNCTION public.student_complete_interview_session(
    p_interview_id    uuid,
    p_session_id      uuid,
    p_idempotency_key text,
    p_request_hash    text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id            uuid := auth.uid();
    v_operation constant text := 'interview_session.complete';
    v_lock_key           bigint;
    v_acquire_result     jsonb;
    v_acquire_status     text;
    v_record_id          uuid;
    v_lease_token        uuid;
    v_existing_type      text;
    v_existing_id        uuid;
    v_row_count          int;
    v_session            public.interview_sessions%ROWTYPE;
    v_ts                 timestamptz;
    v_q                  RECORD;
    v_answer             public.interview_session_answers%ROWTYPE;
    v_snapshot           jsonb;
    v_completion_ok      boolean;
    -- Versioning constants for evaluations and results (P6.3 scope = pending only)
    v_rubric_ver  constant integer := 1;
    v_prompt_ver  constant integer := 1;
    v_scoring_ver constant integer := 1;
BEGIN
    -- 1. Identity and active-account validation
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;
    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    -- 2. Advisory transaction lock (same formula as existing lifecycle engine)
    v_lock_key := hashtextextended(
        jsonb_build_array(v_user_id::text, v_operation, p_idempotency_key)::text, 0
    );
    IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    END IF;

    -- 3. Idempotency acquisition
    v_acquire_result := public.acquire_idempotency_lease(
        v_user_id, v_operation, p_idempotency_key, p_request_hash, 60
    );
    v_acquire_status := v_acquire_result->>'status';

    IF v_acquire_status = 'conflict' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    ELSIF v_acquire_status = 'in_progress' THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    ELSIF v_acquire_status = 'replay' THEN
        IF v_acquire_result->>'response_status' IS NULL OR v_acquire_result->>'response_body' IS NULL THEN
            RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
        END IF;
        RETURN jsonb_build_object(
            'replayed', true,
            'response_status', (v_acquire_result->>'response_status')::int,
            'snapshot', v_acquire_result->'response_body'
        );
    ELSIF v_acquire_status = 'unavailable' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    ELSIF v_acquire_status != 'acquired' THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    v_record_id   := (v_acquire_result->>'record_id')::uuid;
    v_lease_token := (v_acquire_result->>'lease_token')::uuid;
    IF v_record_id IS NULL OR v_lease_token IS NULL THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 4. Resource binding — bind to interview_session
    SELECT resource_type, resource_id INTO v_existing_type, v_existing_id
    FROM public.idempotency_records WHERE id = v_record_id;

    IF (v_existing_type IS NOT NULL AND v_existing_type != 'interview_session') OR
       (v_existing_id IS NOT NULL AND v_existing_id != p_session_id) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    END IF;

    UPDATE public.idempotency_records
    SET resource_type = 'interview_session',
        resource_id   = p_session_id
    WHERE id = v_record_id AND lease_token = v_lease_token AND status = 'processing';

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count != 1 THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    -- 5. Lock session row (ownership + state validation)
    SELECT * INTO v_session
    FROM public.interview_sessions
    WHERE id = p_session_id
      AND interview_id = p_interview_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF v_session.status::text != 'in_progress' THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- 6. Authoritative post-lock timestamp
    v_ts := pg_catalog.clock_timestamp();

    -- 7. Lock all session questions deterministically (display_order ASC, id ASC)
    --    Iterate and process each question.
    --    Note: Migration 25 answer trigger checks session status = in_progress.
    --    All answer/evaluation writes MUST occur BEFORE we transition the session.
    FOR v_q IN
        SELECT q.id AS question_id
        FROM public.interview_session_questions q
        WHERE q.session_id = p_session_id
        ORDER BY q.display_order ASC, q.id ASC
        FOR UPDATE
    LOOP
        -- Check for existing answer
        SELECT * INTO v_answer
        FROM public.interview_session_answers
        WHERE session_id = p_session_id AND session_question_id = v_q.question_id
        FOR UPDATE;

        IF NOT FOUND THEN
            -- 8a. No answer → insert skipped answer
            INSERT INTO public.interview_session_answers (
                user_id, interview_id, session_id, session_question_id,
                response_type, text_response, code_response,
                status, version, finalized_at, skipped_at, created_at, updated_at
            ) VALUES (
                v_user_id, p_interview_id, p_session_id, v_q.question_id,
                NULL, NULL, NULL,
                'skipped', 1, NULL, v_ts, v_ts, v_ts
            )
            RETURNING * INTO v_answer;

            -- Audit: ANSWER_SKIPPED
            INSERT INTO public.audit_logs (
                actor_user_id, actor_type, action,
                resource_type, resource_id, created_at, metadata
            ) VALUES (
                v_user_id, 'user', 'ANSWER_SKIPPED',
                'interview_session_answer', v_answer.id, v_ts,
                jsonb_build_object(
                    'interview_id', p_interview_id,
                    'session_id', p_session_id,
                    'session_question_id', v_q.question_id,
                    'idempotency_record_id', v_record_id
                )
            );

            -- Insert skipped evaluation for skipped answer
            INSERT INTO public.interview_answer_evaluations (
                user_id, interview_id, session_id, session_question_id,
                answer_id, status, evaluation_version,
                rubric_version, prompt_version, scoring_version,
                attempt_count,
                created_at, updated_at
            ) VALUES (
                v_user_id, p_interview_id, p_session_id, v_q.question_id,
                v_answer.id, 'skipped', 1,
                NULL, NULL, NULL,
                0,
                v_ts, v_ts
            );

            -- Audit: EVALUATION_QUEUED (skipped)
            INSERT INTO public.audit_logs (
                actor_user_id, actor_type, action,
                resource_type, resource_id, created_at, metadata
            ) VALUES (
                v_user_id, 'user', 'EVALUATION_QUEUED',
                'interview_answer_evaluation', v_answer.id, v_ts,
                jsonb_build_object(
                    'interview_id', p_interview_id,
                    'session_id', p_session_id,
                    'session_question_id', v_q.question_id,
                    'answer_status', 'skipped',
                    'evaluation_status', 'skipped',
                    'idempotency_record_id', v_record_id
                )
            );

        ELSIF v_answer.status = 'draft' THEN
            -- 8b. Draft answer → finalize it
            UPDATE public.interview_session_answers
            SET status       = 'finalized',
                finalized_at = v_ts,
                version      = v_answer.version + 1
            WHERE id = v_answer.id
            RETURNING * INTO v_answer;

            -- Audit: ANSWER_FINALIZED
            INSERT INTO public.audit_logs (
                actor_user_id, actor_type, action,
                resource_type, resource_id, created_at, metadata
            ) VALUES (
                v_user_id, 'user', 'ANSWER_FINALIZED',
                'interview_session_answer', v_answer.id, v_ts,
                jsonb_build_object(
                    'interview_id', p_interview_id,
                    'session_id', p_session_id,
                    'session_question_id', v_q.question_id,
                    'version', v_answer.version,
                    'via_completion', true,
                    'idempotency_record_id', v_record_id
                )
            );

            -- Insert pending evaluation for finalized (was draft) answer
            INSERT INTO public.interview_answer_evaluations (
                user_id, interview_id, session_id, session_question_id,
                answer_id, status, evaluation_version,
                rubric_version, prompt_version, scoring_version,
                attempt_count,
                created_at, updated_at
            ) VALUES (
                v_user_id, p_interview_id, p_session_id, v_q.question_id,
                v_answer.id, 'pending', 1,
                v_rubric_ver, v_prompt_ver, v_scoring_ver,
                0,
                v_ts, v_ts
            );

            -- Audit: EVALUATION_QUEUED (pending)
            INSERT INTO public.audit_logs (
                actor_user_id, actor_type, action,
                resource_type, resource_id, created_at, metadata
            ) VALUES (
                v_user_id, 'user', 'EVALUATION_QUEUED',
                'interview_answer_evaluation', v_answer.id, v_ts,
                jsonb_build_object(
                    'interview_id', p_interview_id,
                    'session_id', p_session_id,
                    'session_question_id', v_q.question_id,
                    'answer_status', 'finalized',
                    'evaluation_status', 'pending',
                    'idempotency_record_id', v_record_id
                )
            );

        ELSIF v_answer.status = 'finalized' THEN
            -- 8c. Already finalized → preserve unchanged, insert pending evaluation
            INSERT INTO public.interview_answer_evaluations (
                user_id, interview_id, session_id, session_question_id,
                answer_id, status, evaluation_version,
                rubric_version, prompt_version, scoring_version,
                attempt_count,
                created_at, updated_at
            ) VALUES (
                v_user_id, p_interview_id, p_session_id, v_q.question_id,
                v_answer.id, 'pending', 1,
                v_rubric_ver, v_prompt_ver, v_scoring_ver,
                0,
                v_ts, v_ts
            );

            -- Audit: EVALUATION_QUEUED (pending for pre-finalized)
            INSERT INTO public.audit_logs (
                actor_user_id, actor_type, action,
                resource_type, resource_id, created_at, metadata
            ) VALUES (
                v_user_id, 'user', 'EVALUATION_QUEUED',
                'interview_answer_evaluation', v_answer.id, v_ts,
                jsonb_build_object(
                    'interview_id', p_interview_id,
                    'session_id', p_session_id,
                    'session_question_id', v_q.question_id,
                    'answer_status', 'finalized',
                    'evaluation_status', 'pending',
                    'idempotency_record_id', v_record_id
                )
            );
        END IF;
        -- Note: 'skipped' answer already handled by no-answer branch above,
        -- but cannot reach here since trigger prevents skipped → anything.
    END LOOP;

    -- 9. Insert exactly one pending session result (BEFORE session transition)
    INSERT INTO public.interview_session_results (
        user_id, interview_id, session_id,
        status, scoring_version, publication_version,
        created_at, updated_at
    ) VALUES (
        v_user_id, p_interview_id, p_session_id,
        'pending', v_scoring_ver, 1,
        v_ts, v_ts
    );

    -- Audit: RESULT_GENERATED (pending creation)
    INSERT INTO public.audit_logs (
        actor_user_id, actor_type, action,
        resource_type, resource_id, created_at, metadata
    ) VALUES (
        v_user_id, 'user', 'RESULT_GENERATED',
        'interview_session_result', p_session_id, v_ts,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'status', 'pending',
            'idempotency_record_id', v_record_id
        )
    );

    -- 10. NOW transition session to completed (AFTER all answer/evaluation writes)
    UPDATE public.interview_sessions
    SET status             = 'completed',
        completed_at       = v_ts,
        paused_at          = NULL,
        last_transition_at = v_ts
    WHERE id = p_session_id
    RETURNING * INTO v_session;

    -- 11. Audit: session completed
    INSERT INTO public.audit_logs (
        actor_user_id, actor_type, action,
        resource_type, resource_id, created_at, metadata
    ) VALUES (
        v_user_id, 'user', 'INTERVIEW_SESSION_COMPLETED',
        'interview_session', p_session_id, v_ts,
        jsonb_build_object(
            'interview_id', p_interview_id,
            'session_id', p_session_id,
            'previous_state', 'in_progress',
            'new_state', 'completed',
            'operation', v_operation,
            'idempotency_record_id', v_record_id
        )
    );

    -- 12. Build snapshot using established session row format
    v_snapshot := row_to_json(v_session)::jsonb;

    -- 13. Complete idempotency lease
    v_completion_ok := public.complete_idempotency_lease(v_record_id, v_lease_token, 200, v_snapshot);
    IF v_completion_ok IS NOT TRUE THEN
        RAISE EXCEPTION 'OPERATION_FAILED' USING ERRCODE = 'XX000';
    END IF;

    RETURN jsonb_build_object(
        'replayed',        false,
        'response_status', 200,
        'snapshot',        v_snapshot
    );
END;
$$;

ALTER FUNCTION public.student_complete_interview_session(uuid,uuid,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.student_complete_interview_session(uuid,uuid,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_complete_interview_session(uuid,uuid,text,text) TO authenticated;
