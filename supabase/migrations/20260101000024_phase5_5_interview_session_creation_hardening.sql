-- Migration 24: Phase 5.5 Interview Session Creation Hardening

-- Function: student_create_interview_session
CREATE OR REPLACE FUNCTION public.student_create_interview_session(
  p_interview_id uuid,
  p_idempotency_key text,
  p_request_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id uuid;
    _idempotency_id uuid;
    _lock_key bigint;
    _operation constant text := 'INTERVIEWS_CREATE_SESSION';
    _existing_idempotency record;
    _interview record;
    _type_active boolean;
    _diff_active boolean;
    _active_taxonomy boolean;
    _session_id uuid;
    _now timestamptz := clock_timestamp();
    _config_snapshot jsonb;
    _q record;
    _q_count integer := 0;
    _q_idx integer := 0;
    _q_limit integer;
    _q_skill_ids uuid[];
    _q_topic_ids uuid[];
    _skill_match boolean;
    _topic_match boolean;
    _session_data jsonb;
    _response_payload jsonb;
BEGIN
    _user_id := auth.uid();
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    _lock_key := hashtextextended(
      jsonb_build_array(
        _user_id::text,
        _operation,
        p_idempotency_key
      )::text,
      0
    );

    -- Idempotency Locking
    IF NOT pg_try_advisory_xact_lock(_lock_key) THEN
        RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
    END IF;

    SELECT * INTO _existing_idempotency
    FROM public.idempotency_records
    WHERE user_id = _user_id
      AND operation = _operation
      AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        IF _existing_idempotency.request_hash IS DISTINCT FROM p_request_hash THEN
            RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
        END IF;

        IF _existing_idempotency.status = 'completed' THEN
            RETURN jsonb_build_object(
                'replayed', true,
                'response_status', COALESCE(_existing_idempotency.response_status, 201),
                'snapshot', _existing_idempotency.response_body,
                'status', _existing_idempotency.response_body->>'status',
                'config_snapshot', _existing_idempotency.response_body->'configSnapshot'
            );
        END IF;

        IF _existing_idempotency.status = 'processing' THEN
            RAISE EXCEPTION 'IDEMPOTENCY_IN_PROGRESS' USING ERRCODE = 'P0006';
        END IF;

        -- For a failed record, reuse Migration 23's established
        -- failed-record reclaim logic.
        DELETE FROM public.idempotency_records WHERE id = _existing_idempotency.id;
    END IF;

    -- Generate Session UUID before idempotency insert
    _session_id := gen_random_uuid();

    -- Check if another request has the same idempotency key
    BEGIN
        INSERT INTO public.idempotency_records (
            user_id,
            operation,
            idempotency_key,
            request_hash,
            status,
            resource_type,
            resource_id,
            locked_until,
            expires_at,
            created_at,
            updated_at
        ) VALUES (
            _user_id,
            _operation,
            p_idempotency_key,
            p_request_hash,
            'processing',
            'interview_session',
            _session_id,
            _now + interval '60 seconds',
            _now + interval '24 hours',
            _now,
            _now
        )
        RETURNING id INTO _idempotency_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE = 'P0007';
    END;

    -- Lock the owned interview configuration
    SELECT * INTO _interview
    FROM public.interviews
    WHERE id = p_interview_id AND user_id = _user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    _q_limit := _interview.question_count;

    -- Validate active referenced taxonomy
    SELECT is_active INTO _type_active FROM public.question_interview_types WHERE id = _interview.interview_type_id;
    SELECT is_active INTO _diff_active FROM public.question_difficulties WHERE id = _interview.difficulty_id;
    IF _type_active IS NOT TRUE OR _diff_active IS NOT TRUE THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- Enforce one non-completed session
    IF EXISTS (
        SELECT 1 FROM public.interview_sessions
        WHERE interview_id = p_interview_id
        AND status IN ('ready', 'in_progress', 'paused')
    ) THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- Session UUID generated earlier

    -- Build config_snapshot
    _config_snapshot := jsonb_build_object(
        'title', _interview.title,
        'targetRole', _interview.target_role,
        'interviewType', jsonb_build_object('id', _interview.interview_type_id, 'name', (SELECT name FROM public.question_interview_types WHERE id = _interview.interview_type_id)),
        'difficulty', jsonb_build_object('id', _interview.difficulty_id, 'name', (SELECT name FROM public.question_difficulties WHERE id = _interview.difficulty_id)),
        'skills', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', qs.id, 'name', qs.name))
            FROM public.interview_skill_mappings ism
            JOIN public.question_skills qs ON qs.id = ism.skill_id
            WHERE ism.interview_id = _interview.id
        ), '[]'::jsonb),
        'topics', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', qt.id, 'name', qt.name))
            FROM public.interview_topic_mappings itm
            JOIN public.question_topics qt ON qt.id = itm.topic_id
            WHERE itm.interview_id = _interview.id
        ), '[]'::jsonb),
        'questionCount', _interview.question_count,
        'timeLimitMinutes', _interview.time_limit_minutes,
        'capturedAt', _now
    );

    -- Ensure required skills/topics are active
    SELECT array_agg(skill_id) INTO _q_skill_ids FROM public.interview_skill_mappings WHERE interview_id = _interview.id;
    SELECT array_agg(topic_id) INTO _q_topic_ids FROM public.interview_topic_mappings WHERE interview_id = _interview.id;

    IF EXISTS (SELECT 1 FROM public.question_skills WHERE id = ANY(_q_skill_ids) AND is_active = false) THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
    IF _q_topic_ids IS NOT NULL AND EXISTS (SELECT 1 FROM public.question_topics WHERE id = ANY(_q_topic_ids) AND is_active = false) THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    -- Insert the ready session (will hit unique constraint if active session exists due to concurrent insert)
    BEGIN
        INSERT INTO public.interview_sessions (
            id, interview_id, user_id, status, config_snapshot, config_snapshot_version, last_transition_at, created_at, updated_at
        ) VALUES (
            _session_id, _interview.id, _user_id, 'ready', _config_snapshot, 1, _now, _now, _now
        ) RETURNING jsonb_build_object(
            'id', id,
            'interviewId', interview_id,
            'status', status,
            'configSnapshot', config_snapshot,
            'startedAt', started_at,
            'pausedAt', paused_at,
            'totalPausedSeconds', total_paused_seconds,
            'completedAt', completed_at,
            'lastTransitionAt', last_transition_at,
            'createdAt', created_at,
            'updatedAt', updated_at
        ) INTO _session_data;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END;

    -- Deterministic Question Selection
    FOR _q IN (
        SELECT q.id, q.question_text, q.category_id, q.difficulty_id, q.interview_type_id
        FROM public.published_questions AS q
        WHERE q.interview_type_id = _interview.interview_type_id
          AND q.difficulty_id = _interview.difficulty_id
          AND (
            SELECT count(*) = array_length(_q_skill_ids, 1)
            FROM public.question_skill_mappings qsm
            WHERE qsm.question_id = q.id AND qsm.skill_id = ANY(_q_skill_ids)
          )
          AND (
             _q_topic_ids IS NULL
             OR array_length(_q_topic_ids, 1) = 0
             OR (
                 SELECT count(*) = array_length(_q_topic_ids, 1)
                 FROM public.question_topic_mappings qtm
                 WHERE qtm.question_id = q.id AND qtm.topic_id = ANY(_q_topic_ids)
             )
          )
        ORDER BY md5(q.id::text || ':' || _session_id::text) ASC, q.id ASC
    ) LOOP
        IF _q_idx >= _q_limit THEN
            EXIT;
        END IF;

        INSERT INTO public.interview_session_questions (
            session_id, question_id, display_order, question_snapshot_version, question_text_snapshot, taxonomy_snapshot, created_at
        ) VALUES (
            _session_id,
            _q.id,
            _q_idx + 1,
            1,
            _q.question_text,
            jsonb_build_object(
                'category', jsonb_build_object('id', _q.category_id, 'name', (SELECT name FROM public.question_categories WHERE id = _q.category_id)),
                'difficulty', jsonb_build_object('id', _q.difficulty_id, 'name', (SELECT name FROM public.question_difficulties WHERE id = _q.difficulty_id)),
                'interviewType', jsonb_build_object('id', _q.interview_type_id, 'name', (SELECT name FROM public.question_interview_types WHERE id = _q.interview_type_id)),
                'skills', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', qs.id, 'name', qs.name)) FROM public.question_skill_mappings qsm JOIN public.question_skills qs ON qs.id = qsm.skill_id WHERE qsm.question_id = _q.id), '[]'::jsonb),
                'topics', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', qt.id, 'name', qt.name)) FROM public.question_topic_mappings qtm JOIN public.question_topics qt ON qt.id = qtm.topic_id WHERE qtm.question_id = _q.id), '[]'::jsonb),
                'sourceQuestionId', _q.id,
                'capturedAt', _now
            ),
            _now
        );

        _q_idx := _q_idx + 1;
    END LOOP;

    IF _q_idx < _q_limit THEN
        RAISE EXCEPTION 'INSUFFICIENT_ELIGIBLE_QUESTIONS' USING ERRCODE = 'P0008';
    END IF;

    -- Audit Log
    INSERT INTO public.audit_logs (
        action, actor_user_id, actor_type, resource_type, resource_id, metadata
    ) VALUES (
        'INTERVIEW_SESSION_CREATED',
        _user_id,
        'user',
        'interview_session',
        _session_id,
        jsonb_build_object(
            'interview_id', _interview.id,
            'session_id', _session_id,
            'operation', 'student_create_interview_session',
            'idempotency_record_id', _idempotency_id
        )
    );

    -- Complete Idempotency
    UPDATE public.idempotency_records
    SET status = 'completed',
        response_status = 201,
        response_body = _session_data,
        locked_until = NULL,
        expires_at = _now + interval '24 hours',
        updated_at = _now
    WHERE id = _idempotency_id;

    RETURN jsonb_build_object(
        'replayed', false,
        'response_status', 201,
        'snapshot', _session_data,
        'status', 'ready',
        'config_snapshot', _config_snapshot
    );
END;
$$;

REVOKE ALL ON FUNCTION public.student_create_interview_session(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_create_interview_session(uuid, text, text) TO authenticated;
