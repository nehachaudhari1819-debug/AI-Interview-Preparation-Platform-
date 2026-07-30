-- Migration 22: Phase 5.3 Interview Configuration RPC Foundation

-- Function 1: student_create_interview_config
CREATE OR REPLACE FUNCTION public.student_create_interview_config(
  p_title text,
  p_target_role text,
  p_interview_type_id uuid,
  p_difficulty_id uuid,
  p_question_count integer,
  p_time_limit_minutes integer,
  p_skill_ids uuid[],
  p_topic_ids uuid[]
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id uuid;
    _new_interview_id uuid;
    _type_active boolean;
    _diff_active boolean;
    _invalid_skills integer;
    _invalid_topics integer;
    _now timestamptz := clock_timestamp();
    _topic_ids uuid[];
BEGIN
    _user_id := auth.uid();

    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF p_title IS NULL OR btrim(p_title) = '' OR length(p_title) > 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;
    IF p_target_role IS NULL OR btrim(p_target_role) = '' OR length(p_target_role) > 100 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;
    IF p_question_count IS NULL OR p_question_count < 1 OR p_question_count > 20 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;
    IF p_time_limit_minutes IS NOT NULL AND (p_time_limit_minutes < 5 OR p_time_limit_minutes > 120) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    IF p_skill_ids IS NULL OR array_length(p_skill_ids, 1) IS NULL OR array_length(p_skill_ids, 1) = 0 OR array_length(p_skill_ids, 1) > 10 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    IF (SELECT count(DISTINCT id) FROM unnest(p_skill_ids) as t(id)) != array_length(p_skill_ids, 1) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    _topic_ids := COALESCE(p_topic_ids, ARRAY[]::uuid[]);
    IF array_length(_topic_ids, 1) > 10 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    IF array_length(_topic_ids, 1) > 0 THEN
        IF (SELECT count(DISTINCT id) FROM unnest(_topic_ids) as t(id)) != array_length(_topic_ids, 1) THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    SELECT is_active INTO _type_active FROM public.question_interview_types WHERE id = p_interview_type_id;
    IF NOT FOUND OR _type_active IS NOT TRUE THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    SELECT is_active INTO _diff_active FROM public.question_difficulties WHERE id = p_difficulty_id;
    IF NOT FOUND OR _diff_active IS NOT TRUE THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    SELECT count(*) INTO _invalid_skills
    FROM unnest(p_skill_ids) as s(id)
    LEFT JOIN public.question_skills qs ON qs.id = s.id AND qs.is_active = true
    WHERE qs.id IS NULL;
    IF _invalid_skills > 0 THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    IF array_length(_topic_ids, 1) IS NOT NULL AND array_length(_topic_ids, 1) > 0 THEN
        SELECT count(*) INTO _invalid_topics
        FROM unnest(_topic_ids) as t(id)
        LEFT JOIN public.question_topics qt ON qt.id = t.id AND qt.is_active = true
        WHERE qt.id IS NULL;
        IF _invalid_topics > 0 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    INSERT INTO public.interviews (
        user_id, title, target_role, interview_type_id, difficulty_id,
        question_count, time_limit_minutes, created_at, updated_at
    ) VALUES (
        _user_id, btrim(p_title), btrim(p_target_role), p_interview_type_id, p_difficulty_id,
        p_question_count, p_time_limit_minutes, _now, _now
    ) RETURNING id INTO _new_interview_id;

    INSERT INTO public.interview_skill_mappings (interview_id, skill_id, created_at)
    SELECT _new_interview_id, id, _now FROM unnest(p_skill_ids) as t(id);

    IF array_length(_topic_ids, 1) IS NOT NULL AND array_length(_topic_ids, 1) > 0 THEN
        INSERT INTO public.interview_topic_mappings (interview_id, topic_id, created_at)
        SELECT _new_interview_id, id, _now FROM unnest(_topic_ids) as t(id);
    END IF;

    RETURN _new_interview_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_create_interview_config(text, text, uuid, uuid, integer, integer, uuid[], uuid[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_create_interview_config(text, text, uuid, uuid, integer, integer, uuid[], uuid[]) TO authenticated;

-- Function 2: student_update_interview_config
CREATE OR REPLACE FUNCTION public.student_update_interview_config(
  p_interview_id uuid,
  p_expected_updated_at timestamptz,
  p_update_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    _user_id uuid;
    _existing record;
    _valid_keys text[] := ARRAY['title', 'targetRole', 'interviewTypeId', 'difficultyId', 'questionCount', 'timeLimitMinutes', 'skillIds', 'topicIds'];
    _payload_keys text[];

    _new_title text;
    _new_target_role text;
    _new_type_id uuid;
    _new_diff_id uuid;
    _new_q_count integer;
    _new_time_limit integer;

    _has_skill_update boolean := false;
    _new_skill_ids uuid[];
    _has_topic_update boolean := false;
    _new_topic_ids uuid[];

    _type_active boolean;
    _diff_active boolean;
    _invalid_skills integer;
    _invalid_topics integer;

    _row_changed boolean := false;
    _mappings_changed boolean := false;
    _now timestamptz := clock_timestamp();

    _existing_skills uuid[];
    _existing_topics uuid[];
BEGIN
    _user_id := auth.uid();
    IF _user_id IS NULL THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO _existing
    FROM public.interviews
    WHERE id = p_interview_id AND user_id = _user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF p_expected_updated_at IS NULL OR _existing.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF p_update_payload IS NULL OR jsonb_typeof(p_update_payload) != 'object' OR p_update_payload = '{}'::jsonb THEN
        RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
    END IF;

    SELECT array_agg(k) INTO _payload_keys FROM jsonb_object_keys(p_update_payload) as k;
    IF _payload_keys IS NOT NULL THEN
        FOR i IN 1..array_length(_payload_keys, 1) LOOP
            IF NOT (_payload_keys[i] = ANY(_valid_keys)) THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END IF;
        END LOOP;
    END IF;

    IF p_update_payload ? 'title' THEN
        IF jsonb_typeof(p_update_payload->'title') != 'string' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _new_title := p_update_payload->>'title';
        IF _new_title IS NULL OR btrim(_new_title) = '' OR length(_new_title) > 100 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _new_title := btrim(_new_title);
    ELSE
        _new_title := _existing.title;
    END IF;

    IF p_update_payload ? 'targetRole' THEN
        IF jsonb_typeof(p_update_payload->'targetRole') != 'string' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _new_target_role := p_update_payload->>'targetRole';
        IF _new_target_role IS NULL OR btrim(_new_target_role) = '' OR length(_new_target_role) > 100 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _new_target_role := btrim(_new_target_role);
    ELSE
        _new_target_role := _existing.target_role;
    END IF;

    IF p_update_payload ? 'interviewTypeId' THEN
        IF jsonb_typeof(p_update_payload->'interviewTypeId') != 'string' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        BEGIN
            _new_type_id := (p_update_payload->>'interviewTypeId')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END;
        IF _new_type_id IS NULL THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    ELSE
        _new_type_id := _existing.interview_type_id;
    END IF;

    IF p_update_payload ? 'difficultyId' THEN
        IF jsonb_typeof(p_update_payload->'difficultyId') != 'string' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        BEGIN
            _new_diff_id := (p_update_payload->>'difficultyId')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END;
        IF _new_diff_id IS NULL THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    ELSE
        _new_diff_id := _existing.difficulty_id;
    END IF;

    IF p_update_payload ? 'questionCount' THEN
        IF jsonb_typeof(p_update_payload->'questionCount') != 'number' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        BEGIN
            _new_q_count := (p_update_payload->>'questionCount')::integer;
        EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END;
        IF _new_q_count IS NULL OR _new_q_count < 1 OR _new_q_count > 20 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    ELSE
        _new_q_count := _existing.question_count;
    END IF;

    IF p_update_payload ? 'timeLimitMinutes' THEN
        IF jsonb_typeof(p_update_payload->'timeLimitMinutes') = 'null' THEN
            _new_time_limit := NULL;
        ELSIF jsonb_typeof(p_update_payload->'timeLimitMinutes') = 'number' THEN
            BEGIN
                _new_time_limit := (p_update_payload->>'timeLimitMinutes')::integer;
            EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END;
            IF _new_time_limit < 5 OR _new_time_limit > 120 THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END IF;
        ELSE
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    ELSE
        _new_time_limit := _existing.time_limit_minutes;
    END IF;

    IF _new_type_id IS DISTINCT FROM _existing.interview_type_id THEN
        SELECT is_active INTO _type_active FROM public.question_interview_types WHERE id = _new_type_id;
        IF NOT FOUND OR _type_active IS NOT TRUE THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    IF _new_diff_id IS DISTINCT FROM _existing.difficulty_id THEN
        SELECT is_active INTO _diff_active FROM public.question_difficulties WHERE id = _new_diff_id;
        IF NOT FOUND OR _diff_active IS NOT TRUE THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    IF p_update_payload ? 'skillIds' THEN
        IF jsonb_typeof(p_update_payload->'skillIds') != 'array' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _has_skill_update := true;
        BEGIN
            SELECT array_agg(x::uuid) INTO _new_skill_ids
            FROM jsonb_array_elements_text(p_update_payload->'skillIds') x;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END;

        IF _new_skill_ids IS NULL OR array_length(_new_skill_ids, 1) IS NULL OR array_length(_new_skill_ids, 1) = 0 OR array_length(_new_skill_ids, 1) > 10 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;

        IF (SELECT count(DISTINCT id) FROM unnest(_new_skill_ids) as t(id)) != array_length(_new_skill_ids, 1) THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;

        SELECT count(*) INTO _invalid_skills
        FROM unnest(_new_skill_ids) as s(id)
        LEFT JOIN public.question_skills qs ON qs.id = s.id AND qs.is_active = true
        WHERE qs.id IS NULL;
        IF _invalid_skills > 0 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
    END IF;

    IF p_update_payload ? 'topicIds' THEN
        IF jsonb_typeof(p_update_payload->'topicIds') != 'array' THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;
        _has_topic_update := true;

        IF jsonb_array_length(p_update_payload->'topicIds') > 0 THEN
            BEGIN
                SELECT array_agg(x::uuid) INTO _new_topic_ids
                FROM jsonb_array_elements_text(p_update_payload->'topicIds') x;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END;
        END IF;

        _new_topic_ids := COALESCE(_new_topic_ids, ARRAY[]::uuid[]);
        IF array_length(_new_topic_ids, 1) > 10 THEN
            RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
        END IF;

        IF array_length(_new_topic_ids, 1) IS NOT NULL AND array_length(_new_topic_ids, 1) > 0 THEN
            IF (SELECT count(DISTINCT id) FROM unnest(_new_topic_ids) as t(id)) != array_length(_new_topic_ids, 1) THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END IF;

            SELECT count(*) INTO _invalid_topics
            FROM unnest(_new_topic_ids) as t(id)
            LEFT JOIN public.question_topics qt ON qt.id = t.id AND qt.is_active = true
            WHERE qt.id IS NULL;
            IF _invalid_topics > 0 THEN
                RAISE EXCEPTION 'VALIDATION_ERROR' USING ERRCODE = 'P0004';
            END IF;
        END IF;
    END IF;

    IF _has_skill_update THEN
        SELECT array_agg(skill_id ORDER BY skill_id) INTO _existing_skills
        FROM public.interview_skill_mappings WHERE interview_id = p_interview_id;
        _existing_skills := COALESCE(_existing_skills, ARRAY[]::uuid[]);

        IF COALESCE((SELECT array_agg(id ORDER BY id) FROM (SELECT t.id FROM unnest(_new_skill_ids) as t(id)) x), ARRAY[]::uuid[]) IS DISTINCT FROM _existing_skills THEN
            _mappings_changed := true;
            DELETE FROM public.interview_skill_mappings WHERE interview_id = p_interview_id;
            INSERT INTO public.interview_skill_mappings (interview_id, skill_id, created_at)
            SELECT p_interview_id, id, _now FROM unnest(_new_skill_ids) as t(id);
        END IF;
    END IF;

    IF _has_topic_update THEN
        SELECT array_agg(topic_id ORDER BY topic_id) INTO _existing_topics
        FROM public.interview_topic_mappings WHERE interview_id = p_interview_id;
        _existing_topics := COALESCE(_existing_topics, ARRAY[]::uuid[]);

        IF COALESCE((SELECT array_agg(id ORDER BY id) FROM (SELECT t.id FROM unnest(_new_topic_ids) as t(id)) x), ARRAY[]::uuid[]) IS DISTINCT FROM _existing_topics THEN
            _mappings_changed := true;
            DELETE FROM public.interview_topic_mappings WHERE interview_id = p_interview_id;
            IF array_length(_new_topic_ids, 1) IS NOT NULL AND array_length(_new_topic_ids, 1) > 0 THEN
                INSERT INTO public.interview_topic_mappings (interview_id, topic_id, created_at)
                SELECT p_interview_id, id, _now FROM unnest(_new_topic_ids) as t(id);
            END IF;
        END IF;
    END IF;

    IF _existing.title IS DISTINCT FROM _new_title OR
       _existing.target_role IS DISTINCT FROM _new_target_role OR
       _existing.interview_type_id IS DISTINCT FROM _new_type_id OR
       _existing.difficulty_id IS DISTINCT FROM _new_diff_id OR
       _existing.question_count IS DISTINCT FROM _new_q_count OR
       _existing.time_limit_minutes IS DISTINCT FROM _new_time_limit THEN
       _row_changed := true;
    END IF;

    IF _row_changed THEN
        UPDATE public.interviews
        SET title = _new_title,
            target_role = _new_target_role,
            interview_type_id = _new_type_id,
            difficulty_id = _new_diff_id,
            question_count = _new_q_count,
            time_limit_minutes = _new_time_limit,
            updated_at = _now
        WHERE id = p_interview_id;
    ELSIF _mappings_changed THEN
        UPDATE public.interviews
        SET updated_at = _now
        WHERE id = p_interview_id;
    END IF;

    RETURN p_interview_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_update_interview_config(uuid, timestamptz, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_update_interview_config(uuid, timestamptz, jsonb) TO authenticated;
