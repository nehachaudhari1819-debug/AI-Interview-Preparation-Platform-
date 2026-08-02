-- Migration 25: Phase 6.2 Interview Answer, Evaluation, Result Foundation

-- 1. Helper Function: Array Validation
CREATE OR REPLACE FUNCTION private.is_bounded_text_array(
  p_value text[],
  p_max_items integer,
  p_max_item_length integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    p_max_items >= 0
    AND p_max_item_length > 0
    AND (
      pg_catalog.cardinality(p_value) = 0
      OR pg_catalog.array_ndims(p_value) = 1
    )
    AND pg_catalog.cardinality(p_value) <= p_max_items
    AND pg_catalog.array_position(p_value, NULL) IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.unnest(p_value) AS element
      WHERE pg_catalog.length(element) < 1
         OR pg_catalog.length(element) > p_max_item_length
    );
$$;

ALTER FUNCTION private.is_bounded_text_array(text[], integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION private.is_bounded_text_array(text[], integer, integer) FROM PUBLIC, anon, authenticated, service_role;

-- 2. Add Missing Parent Ownership Unique Constraints
ALTER TABLE public.interview_sessions ADD CONSTRAINT interview_sessions_id_interview_id_user_id_key UNIQUE (id, interview_id, user_id);
ALTER TABLE public.interview_session_questions ADD CONSTRAINT interview_session_questions_id_session_id_key UNIQUE (id, session_id);

-- 3. Answers Table
CREATE TABLE public.interview_session_answers (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL,
    interview_id uuid NOT NULL,
    session_id uuid NOT NULL,
    session_question_id uuid NOT NULL,
    response_type text,
    text_response text,
    code_response jsonb,
    status text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    finalized_at timestamptz,
    skipped_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),

    CONSTRAINT answers_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT answers_session_fkey FOREIGN KEY (session_id, interview_id, user_id) REFERENCES public.interview_sessions(id, interview_id, user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT answers_question_fkey FOREIGN KEY (session_question_id, session_id) REFERENCES public.interview_session_questions(id, session_id) ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT interview_session_answers_session_question_key UNIQUE (session_id, session_question_id),
    CONSTRAINT interview_session_answers_ownership_key UNIQUE (id, session_question_id, session_id, interview_id, user_id),

    CONSTRAINT chk_answer_response_type CHECK (response_type IN ('text', 'code') OR response_type IS NULL),
    CONSTRAINT chk_answer_text_bounds CHECK (text_response IS NULL OR pg_catalog.length(text_response) BETWEEN 1 AND 10000),
    CONSTRAINT chk_answer_code_contract CHECK (
      (
        code_response IS NULL
        OR (
          pg_catalog.jsonb_typeof(code_response) IS NOT DISTINCT FROM 'object'
          AND code_response ? 'source'
          AND code_response ? 'language'
          AND code_response ? 'explanation'
          AND (code_response - 'source' - 'language' - 'explanation') = '{}'::jsonb
          AND pg_catalog.jsonb_typeof(code_response->'source') IS NOT DISTINCT FROM 'string'
          AND pg_catalog.jsonb_typeof(code_response->'language') IS NOT DISTINCT FROM 'string'
          AND pg_catalog.jsonb_typeof(code_response->'explanation') IS NOT DISTINCT FROM 'string'
          AND pg_catalog.length(code_response->>'source') BETWEEN 1 AND 50000
          AND pg_catalog.length(code_response->>'explanation') BETWEEN 1 AND 10000
          AND (code_response->>'language') IN ('python', 'javascript', 'typescript', 'java', 'cpp', 'go', 'rust')
        )
      ) IS TRUE
    ),
    CONSTRAINT chk_answer_status CHECK (status IN ('draft', 'finalized', 'skipped')),
    CONSTRAINT chk_answer_version CHECK (version > 0),
    CONSTRAINT chk_answer_state_predicate CHECK (
      (
        (status = 'draft' AND response_type IS NOT NULL AND response_type IN ('text', 'code') AND ((response_type = 'text' AND text_response IS NOT NULL AND code_response IS NULL) OR (response_type = 'code' AND code_response IS NOT NULL AND text_response IS NULL)) AND finalized_at IS NULL AND skipped_at IS NULL) OR
        (status = 'finalized' AND response_type IS NOT NULL AND response_type IN ('text', 'code') AND ((response_type = 'text' AND text_response IS NOT NULL AND code_response IS NULL) OR (response_type = 'code' AND code_response IS NOT NULL AND text_response IS NULL)) AND finalized_at IS NOT NULL AND skipped_at IS NULL) OR
        (status = 'skipped' AND response_type IS NULL AND text_response IS NULL AND code_response IS NULL AND skipped_at IS NOT NULL AND finalized_at IS NULL)
      ) IS TRUE
    )
);

ALTER TABLE public.interview_session_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_session_answers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interview_session_answers FROM PUBLIC, anon, authenticated, service_role;

-- 4. Evaluations Table
CREATE TABLE public.interview_answer_evaluations (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL,
    interview_id uuid NOT NULL,
    session_id uuid NOT NULL,
    session_question_id uuid NOT NULL,
    answer_id uuid NOT NULL,
    status text NOT NULL,
    evaluation_version integer NOT NULL DEFAULT 1,
    rubric_version integer,
    prompt_version integer,
    scoring_version integer,
    provider text,
    model text,
    attempt_count integer NOT NULL DEFAULT 0,
    lease_token uuid,
    lease_expires_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    failure_code text,
    overall_score integer,
    dimension_scores jsonb,
    strengths text[],
    improvement_areas text[],
    student_feedback text,
    evaluator_metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),

    CONSTRAINT evaluations_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT interview_answer_evaluations_answer_chain_fkey FOREIGN KEY (answer_id, session_question_id, session_id, interview_id, user_id) REFERENCES public.interview_session_answers (id, session_question_id, session_id, interview_id, user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_eval_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    CONSTRAINT chk_eval_version_fields CHECK (evaluation_version > 0 AND (rubric_version IS NULL OR rubric_version > 0) AND (prompt_version IS NULL OR prompt_version > 0) AND (scoring_version IS NULL OR scoring_version > 0)),
    CONSTRAINT chk_eval_attempt_range CHECK (attempt_count BETWEEN 0 AND 3),
    CONSTRAINT chk_eval_score_range CHECK (overall_score IS NULL OR (overall_score BETWEEN 0 AND 100)),
    CONSTRAINT chk_eval_array_bounds CHECK (
      (strengths IS NULL OR private.is_bounded_text_array(strengths, 5, 200)) AND
      (improvement_areas IS NULL OR private.is_bounded_text_array(improvement_areas, 5, 200))
    ),
    CONSTRAINT chk_eval_feedback_bounds CHECK (student_feedback IS NULL OR pg_catalog.length(pg_catalog.btrim(student_feedback)) BETWEEN 1 AND 2000),
    CONSTRAINT chk_eval_provider_bounds CHECK (provider IS NULL OR pg_catalog.length(pg_catalog.btrim(provider)) BETWEEN 1 AND 100),
    CONSTRAINT chk_eval_model_bounds CHECK (model IS NULL OR pg_catalog.length(pg_catalog.btrim(model)) BETWEEN 1 AND 200),
    CONSTRAINT chk_eval_failure_code_bounds CHECK (failure_code IS NULL OR pg_catalog.length(pg_catalog.btrim(failure_code)) BETWEEN 1 AND 100),
    CONSTRAINT chk_eval_state_predicate CHECK (
      (
        (status = 'pending' AND attempt_count BETWEEN 0 AND 2 AND started_at IS NULL AND completed_at IS NULL AND failed_at IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND provider IS NULL AND model IS NULL AND evaluator_metadata IS NULL AND overall_score IS NULL AND dimension_scores IS NULL AND strengths IS NULL AND improvement_areas IS NULL AND student_feedback IS NULL AND failure_code IS NULL AND rubric_version IS NOT NULL AND rubric_version > 0 AND prompt_version IS NOT NULL AND prompt_version > 0 AND scoring_version IS NOT NULL AND scoring_version > 0) OR
        (status = 'processing' AND attempt_count BETWEEN 1 AND 3 AND started_at IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND lease_expires_at > started_at AND completed_at IS NULL AND failed_at IS NULL AND overall_score IS NULL AND dimension_scores IS NULL AND strengths IS NULL AND improvement_areas IS NULL AND student_feedback IS NULL AND failure_code IS NULL AND rubric_version IS NOT NULL AND rubric_version > 0 AND prompt_version IS NOT NULL AND prompt_version > 0 AND scoring_version IS NOT NULL AND scoring_version > 0) OR
        (status = 'completed' AND attempt_count BETWEEN 1 AND 3 AND started_at IS NOT NULL AND completed_at IS NOT NULL AND completed_at >= started_at AND provider IS NOT NULL AND model IS NOT NULL AND overall_score IS NOT NULL AND dimension_scores IS NOT NULL AND strengths IS NOT NULL AND improvement_areas IS NOT NULL AND student_feedback IS NOT NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND failed_at IS NULL AND failure_code IS NULL AND rubric_version IS NOT NULL AND rubric_version > 0 AND prompt_version IS NOT NULL AND prompt_version > 0 AND scoring_version IS NOT NULL AND scoring_version > 0) OR
        (status = 'failed' AND attempt_count BETWEEN 1 AND 3 AND started_at IS NOT NULL AND failed_at IS NOT NULL AND failed_at >= started_at AND failure_code IS NOT NULL AND overall_score IS NULL AND dimension_scores IS NULL AND strengths IS NULL AND improvement_areas IS NULL AND student_feedback IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND completed_at IS NULL AND rubric_version IS NOT NULL AND rubric_version > 0 AND prompt_version IS NOT NULL AND prompt_version > 0 AND scoring_version IS NOT NULL AND scoring_version > 0) OR
        (status = 'skipped' AND attempt_count = 0 AND provider IS NULL AND model IS NULL AND rubric_version IS NULL AND prompt_version IS NULL AND scoring_version IS NULL AND evaluator_metadata IS NULL AND started_at IS NULL AND completed_at IS NULL AND failed_at IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL AND overall_score IS NULL AND dimension_scores IS NULL AND strengths IS NULL AND improvement_areas IS NULL AND student_feedback IS NULL AND failure_code IS NULL)
      ) IS TRUE
    )
);

ALTER TABLE public.interview_answer_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answer_evaluations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interview_answer_evaluations FROM PUBLIC, anon, authenticated, service_role;

-- 5. Results Table
CREATE TABLE public.interview_session_results (
    id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id uuid NOT NULL,
    interview_id uuid NOT NULL,
    session_id uuid NOT NULL,
    status text NOT NULL,
    overall_score integer,
    score_breakdown jsonb,
    strengths text[],
    improvement_summary text,
    scoring_version integer NOT NULL,
    publication_version integer NOT NULL DEFAULT 1,
    generated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),

    CONSTRAINT results_user_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT results_session_fkey FOREIGN KEY (session_id, interview_id, user_id) REFERENCES public.interview_sessions(id, interview_id, user_id) ON UPDATE RESTRICT ON DELETE RESTRICT,

    CONSTRAINT chk_result_status CHECK (status IN ('pending', 'partial', 'ready', 'failed')),
    CONSTRAINT chk_result_score_range CHECK (overall_score IS NULL OR (overall_score BETWEEN 0 AND 100)),
    CONSTRAINT chk_result_strengths_bounds CHECK (strengths IS NULL OR private.is_bounded_text_array(strengths, 5, 200)),
    CONSTRAINT chk_result_summary_bounds CHECK (improvement_summary IS NULL OR pg_catalog.length(pg_catalog.btrim(improvement_summary)) BETWEEN 1 AND 2000),
    CONSTRAINT chk_result_version_fields CHECK (scoring_version > 0 AND publication_version > 0),
    CONSTRAINT chk_result_state_predicate CHECK (
      (
        (status IN ('pending', 'partial', 'failed') AND overall_score IS NULL AND score_breakdown IS NULL AND strengths IS NULL AND improvement_summary IS NULL AND generated_at IS NULL) OR
        (status = 'ready' AND overall_score IS NOT NULL AND score_breakdown IS NOT NULL AND strengths IS NOT NULL AND improvement_summary IS NOT NULL AND generated_at IS NOT NULL)
      ) IS TRUE
    )
);

ALTER TABLE public.interview_session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_session_results FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interview_session_results FROM PUBLIC, anon, authenticated, service_role;

-- 6. Indexes
CREATE INDEX idx_interview_session_answers_status ON public.interview_session_answers (status);
CREATE UNIQUE INDEX idx_evaluations_answer_version ON public.interview_answer_evaluations (answer_id, evaluation_version);
CREATE INDEX idx_evaluations_worker_claim ON public.interview_answer_evaluations (created_at ASC, id ASC) WHERE status = 'pending' AND attempt_count < 3;
CREATE INDEX idx_evaluations_expired_lease ON public.interview_answer_evaluations (lease_expires_at ASC, created_at ASC, id ASC) WHERE status = 'processing' AND attempt_count < 3;
CREATE INDEX idx_evaluations_exhausted_lease ON public.interview_answer_evaluations (lease_expires_at ASC, created_at ASC, id ASC) WHERE status = 'processing' AND attempt_count = 3;
CREATE INDEX idx_evaluations_session ON public.interview_answer_evaluations (session_id);
CREATE UNIQUE INDEX idx_results_session_version ON public.interview_session_results (session_id, publication_version);
CREATE INDEX idx_interview_session_results_latest ON public.interview_session_results (session_id, publication_version DESC);
CREATE INDEX idx_results_user_session ON public.interview_session_results (user_id, session_id);

-- 7. Answer Trigger
CREATE OR REPLACE FUNCTION private.enforce_interview_session_answer_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.version IS DISTINCT FROM 1 THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
    IF NEW.status = 'finalized' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN OLD;
    END IF;

    IF OLD.status = 'skipped' THEN
      RAISE EXCEPTION 'ANSWER_SKIPPED' USING ERRCODE = 'P0014';
    END IF;

    IF OLD.status = 'finalized' THEN
      RAISE EXCEPTION 'ANSWER_IMMUTABLE' USING ERRCODE = 'P0013';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.interview_id IS DISTINCT FROM OLD.interview_id OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.session_question_id IS DISTINCT FROM OLD.session_question_id OR NEW.response_type IS DISTINCT FROM OLD.response_type OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF OLD.status = 'draft' AND NEW.status IS DISTINCT FROM 'draft' AND NEW.status IS DISTINCT FROM 'finalized' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF NEW.version IS DISTINCT FROM OLD.version + 1 THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    NEW.updated_at = pg_catalog.clock_timestamp();
  END IF;

  SELECT status INTO v_session_status
  FROM public.interview_sessions
  WHERE id = NEW.session_id;

  IF v_session_status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'SESSION_TERMINAL' USING ERRCODE = 'P0011';
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.enforce_interview_session_answer_contract() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_interview_session_answer_contract() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_interview_session_answer_contract
BEFORE INSERT OR UPDATE ON public.interview_session_answers
FOR EACH ROW EXECUTE FUNCTION private.enforce_interview_session_answer_contract();

-- 8. Evaluation Trigger
CREATE OR REPLACE FUNCTION private.enforce_interview_answer_evaluation_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_answer_status text;
  v_answer_type text;
  v_expected_keys text[];
  v_key text;
  v_val jsonb;
  v_str text;
  v_now timestamptz;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending'
       AND NEW.status IS DISTINCT FROM 'skipped' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN OLD;
    END IF;

    IF OLD.status = 'completed' OR OLD.status = 'failed' OR OLD.status = 'skipped' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF OLD.status = 'pending' THEN
      IF NEW.status IS DISTINCT FROM 'processing' THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
      END IF;

      v_now := pg_catalog.clock_timestamp();

      IF NEW.attempt_count IS DISTINCT FROM OLD.attempt_count + 1
         OR NEW.started_at IS NULL
         OR NEW.lease_token IS NULL
         OR NEW.lease_expires_at IS NULL
         OR NEW.lease_expires_at IS DISTINCT FROM
              NEW.started_at + interval '5 minutes'
         OR NEW.lease_expires_at <= v_now THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT'
          USING ERRCODE = 'P0003';
      END IF;
    END IF;

    IF OLD.status = 'processing' THEN
      IF NEW.status = 'processing' THEN
        v_now := pg_catalog.clock_timestamp();

        IF OLD.attempt_count >= 3
           OR OLD.lease_expires_at IS NULL
           OR OLD.lease_expires_at > v_now THEN
          RAISE EXCEPTION 'RESOURCE_CONFLICT'
            USING ERRCODE = 'P0003';
        END IF;

        IF NEW.attempt_count IS DISTINCT FROM OLD.attempt_count + 1
           OR NEW.started_at IS NULL
           OR NEW.lease_token IS NULL
           OR NEW.lease_token IS NOT DISTINCT FROM OLD.lease_token
           OR NEW.lease_expires_at IS NULL
           OR NEW.lease_expires_at IS DISTINCT FROM
                NEW.started_at + interval '5 minutes'
           OR NEW.lease_expires_at <= v_now THEN
          RAISE EXCEPTION 'RESOURCE_CONFLICT'
            USING ERRCODE = 'P0003';
        END IF;
      ELSIF NEW.status = 'completed' OR NEW.status = 'failed' THEN
        IF NEW.attempt_count IS DISTINCT FROM OLD.attempt_count THEN
          RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
        END IF;
      ELSE
        RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
      END IF;
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.interview_id IS DISTINCT FROM OLD.interview_id OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.session_question_id IS DISTINCT FROM OLD.session_question_id OR NEW.answer_id IS DISTINCT FROM OLD.answer_id OR NEW.evaluation_version IS DISTINCT FROM OLD.evaluation_version OR NEW.rubric_version IS DISTINCT FROM OLD.rubric_version OR NEW.prompt_version IS DISTINCT FROM OLD.prompt_version OR NEW.scoring_version IS DISTINCT FROM OLD.scoring_version OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    NEW.updated_at = pg_catalog.clock_timestamp();
  END IF;

  SELECT status, response_type INTO v_answer_status, v_answer_type
  FROM public.interview_session_answers
  WHERE id = NEW.answer_id
    AND session_question_id = NEW.session_question_id
    AND session_id = NEW.session_id
    AND interview_id = NEW.interview_id
    AND user_id = NEW.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM 'skipped'
     AND v_answer_status IS DISTINCT FROM 'skipped' THEN
    RAISE EXCEPTION 'WORKER_VALIDATION_FAILED'
      USING ERRCODE = 'P0015';
  END IF;

  IF NEW.status IS DISTINCT FROM 'skipped'
     AND v_answer_status IS DISTINCT FROM 'finalized' THEN
    RAISE EXCEPTION 'WORKER_VALIDATION_FAILED'
      USING ERRCODE = 'P0015';
  END IF;

  IF NEW.dimension_scores IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(NEW.dimension_scores) != 'object' THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF v_answer_type = 'text' THEN
      v_expected_keys := ARRAY['technicalAccuracy', 'relevance', 'completeness', 'clarity', 'technicalDepth'];
    ELSIF v_answer_type = 'code' THEN
      v_expected_keys := ARRAY['correctness', 'approach', 'codeQuality', 'complexity', 'explanationClarity'];
    ELSE
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF (SELECT count(*) FROM pg_catalog.jsonb_object_keys(NEW.dimension_scores)) != pg_catalog.array_length(v_expected_keys, 1) THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    FOREACH v_key IN ARRAY v_expected_keys LOOP
      IF NOT NEW.dimension_scores ? v_key THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      v_val := NEW.dimension_scores -> v_key;
      IF pg_catalog.jsonb_typeof(v_val) != 'number' THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      v_str := v_val #>> '{}';
      IF v_str !~ '^(0|[1-9][0-9]{0,2})$' THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      IF v_str::integer NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;
    END LOOP;
  END IF;

  IF NEW.evaluator_metadata IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(NEW.evaluator_metadata) != 'object' THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF NOT (
      NEW.evaluator_metadata ? 'worker_id' AND
      NEW.evaluator_metadata ? 'request_id' AND
      NEW.evaluator_metadata ? 'latency_ms' AND
      NEW.evaluator_metadata ? 'token_usage' AND
      (SELECT count(*) FROM pg_catalog.jsonb_object_keys(NEW.evaluator_metadata)) = 4
    ) THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF pg_catalog.jsonb_typeof(NEW.evaluator_metadata->'worker_id') != 'string' OR
       pg_catalog.length(pg_catalog.btrim(NEW.evaluator_metadata->>'worker_id')) NOT BETWEEN 1 AND 100 OR
       pg_catalog.jsonb_typeof(NEW.evaluator_metadata->'request_id') != 'string' OR
       pg_catalog.length(pg_catalog.btrim(NEW.evaluator_metadata->>'request_id')) NOT BETWEEN 1 AND 100 THEN
       RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    v_val := NEW.evaluator_metadata->'latency_ms';
    IF pg_catalog.jsonb_typeof(v_val) != 'number' THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;
    v_str := v_val #>> '{}';
    IF v_str !~ '^(0|[1-9][0-9]*)$' OR pg_catalog.length(v_str) > 6 THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF v_str::integer > 600000 THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    v_val := NEW.evaluator_metadata->'token_usage';
    IF pg_catalog.jsonb_typeof(v_val) != 'number' THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;
    v_str := v_val #>> '{}';
    IF v_str !~ '^(0|[1-9][0-9]*)$' OR pg_catalog.length(v_str) > 6 THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    IF v_str::integer > 100000 THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.enforce_interview_answer_evaluation_contract() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_interview_answer_evaluation_contract() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_interview_answer_evaluation_contract
BEFORE INSERT OR UPDATE ON public.interview_answer_evaluations
FOR EACH ROW EXECUTE FUNCTION private.enforce_interview_answer_evaluation_contract();

-- 9. Result Trigger
CREATE OR REPLACE FUNCTION private.enforce_interview_session_result_contract()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected_q_count int;
  v_breakdown_count int;
  v_key text;
  v_val jsonb;
  v_str text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'pending' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW IS NOT DISTINCT FROM OLD THEN
      RETURN OLD;
    END IF;

    IF OLD.status = 'pending'
       AND NEW.status IS DISTINCT FROM 'pending'
       AND NEW.status IS DISTINCT FROM 'partial'
       AND NEW.status IS DISTINCT FROM 'ready'
       AND NEW.status IS DISTINCT FROM 'failed' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT'
        USING ERRCODE = 'P0003';
    END IF;

    IF OLD.status = 'ready' OR OLD.status = 'failed' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF OLD.status = 'partial' AND NEW.status IS DISTINCT FROM 'partial' AND NEW.status IS DISTINCT FROM 'ready' AND NEW.status IS DISTINCT FROM 'failed' THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.interview_id IS DISTINCT FROM OLD.interview_id OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.scoring_version IS DISTINCT FROM OLD.scoring_version OR NEW.publication_version IS DISTINCT FROM OLD.publication_version OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'RESOURCE_CONFLICT' USING ERRCODE = 'P0003';
    END IF;

    NEW.updated_at = pg_catalog.clock_timestamp();
  END IF;

  IF NEW.score_breakdown IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(NEW.score_breakdown) != 'object' THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    SELECT count(*) INTO v_expected_q_count
    FROM public.interview_session_questions
    WHERE session_id = NEW.session_id;

    SELECT count(*) INTO v_breakdown_count
    FROM pg_catalog.jsonb_object_keys(NEW.score_breakdown);

    IF v_expected_q_count != v_breakdown_count THEN
      RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
    END IF;

    FOR v_key IN SELECT pg_catalog.jsonb_object_keys(NEW.score_breakdown) LOOP
      IF NOT (v_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM public.interview_session_questions
        WHERE session_id = NEW.session_id AND id = v_key::uuid
      ) THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      v_val := NEW.score_breakdown -> v_key;
      IF pg_catalog.jsonb_typeof(v_val) != 'number' THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      v_str := v_val #>> '{}';
      IF v_str !~ '^(0|[1-9][0-9]{0,2})$' THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;

      IF v_str::integer NOT BETWEEN 0 AND 100 THEN
        RAISE EXCEPTION 'WORKER_VALIDATION_FAILED' USING ERRCODE = 'P0015';
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION private.enforce_interview_session_result_contract() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.enforce_interview_session_result_contract() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_interview_session_result_contract
BEFORE INSERT OR UPDATE ON public.interview_session_results
FOR EACH ROW EXECUTE FUNCTION private.enforce_interview_session_result_contract();

-- 10. Read RPCs
CREATE OR REPLACE FUNCTION public.student_list_session_answers(
    p_interview_id uuid,
    p_session_id uuid
)
RETURNS TABLE (
    id uuid,
    session_question_id uuid,
    response_type text,
    text_response text,
    code_response jsonb,
    status text,
    version integer,
    finalized_at timestamptz,
    skipped_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL OR private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.interview_sessions AS owned_session
        WHERE owned_session.id = p_session_id
          AND owned_session.interview_id = p_interview_id
          AND owned_session.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT a.id, a.session_question_id, a.response_type, a.text_response, a.code_response, a.status, a.version, a.finalized_at, a.skipped_at, a.created_at, a.updated_at
    FROM public.interview_session_answers a
    JOIN public.interview_session_questions q ON a.session_question_id = q.id
    WHERE a.session_id = p_session_id AND a.interview_id = p_interview_id AND a.user_id = v_user_id
    ORDER BY q.display_order ASC, a.session_question_id ASC;
END;
$$;
ALTER FUNCTION public.student_list_session_answers(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_list_session_answers(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.student_list_session_answers(uuid, uuid) FROM PUBLIC, anon, service_role;

CREATE OR REPLACE FUNCTION public.student_get_session_answer(
    p_interview_id uuid,
    p_session_id uuid,
    p_session_question_id uuid
)
RETURNS TABLE (
    id uuid,
    session_question_id uuid,
    response_type text,
    text_response text,
    code_response jsonb,
    status text,
    version integer,
    finalized_at timestamptz,
    skipped_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL OR private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.interview_sessions AS owned_session
        WHERE owned_session.id = p_session_id
          AND owned_session.interview_id = p_interview_id
          AND owned_session.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT a.id, a.session_question_id, a.response_type, a.text_response, a.code_response, a.status, a.version, a.finalized_at, a.skipped_at, a.created_at, a.updated_at
    FROM public.interview_session_answers a
    WHERE a.session_id = p_session_id AND a.interview_id = p_interview_id AND a.user_id = v_user_id AND a.session_question_id = p_session_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
END;
$$;
ALTER FUNCTION public.student_get_session_answer(uuid, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_get_session_answer(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.student_get_session_answer(uuid, uuid, uuid) FROM PUBLIC, anon, service_role;

CREATE OR REPLACE FUNCTION public.student_get_answer_evaluation(
    p_interview_id uuid,
    p_session_id uuid,
    p_session_question_id uuid
)
RETURNS TABLE (
    id uuid,
    answer_id uuid,
    status text,
    evaluation_version integer,
    rubric_version integer,
    prompt_version integer,
    scoring_version integer,
    failure_code text,
    attempt_count integer,
    started_at timestamptz,
    completed_at timestamptz,
    failed_at timestamptz,
    overall_score integer,
    dimension_scores jsonb,
    strengths text[],
    improvement_areas text[],
    student_feedback text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL OR private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.interview_sessions AS owned_session
        WHERE owned_session.id = p_session_id
          AND owned_session.interview_id = p_interview_id
          AND owned_session.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT e.id, e.answer_id, e.status, e.evaluation_version, e.rubric_version, e.prompt_version, e.scoring_version, e.failure_code, e.attempt_count, e.started_at, e.completed_at, e.failed_at, e.overall_score, e.dimension_scores, e.strengths, e.improvement_areas, e.student_feedback, e.created_at, e.updated_at
    FROM public.interview_answer_evaluations e
    WHERE e.session_id = p_session_id AND e.interview_id = p_interview_id AND e.user_id = v_user_id AND e.session_question_id = p_session_question_id
    ORDER BY e.evaluation_version DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
END;
$$;
ALTER FUNCTION public.student_get_answer_evaluation(uuid, uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_get_answer_evaluation(uuid, uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.student_get_answer_evaluation(uuid, uuid, uuid) FROM PUBLIC, anon, service_role;

CREATE OR REPLACE FUNCTION public.student_get_latest_session_result(
    p_interview_id uuid,
    p_session_id uuid
)
RETURNS TABLE (
    id uuid,
    status text,
    overall_score integer,
    score_breakdown jsonb,
    strengths text[],
    improvement_summary text,
    scoring_version integer,
    publication_version integer,
    generated_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
BEGIN
    IF v_user_id IS NULL OR private.is_active_user() IS NOT TRUE THEN
        RAISE EXCEPTION 'FORBIDDEN_ACCESS' USING ERRCODE = 'P0001';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.interview_sessions AS owned_session
        WHERE owned_session.id = p_session_id
          AND owned_session.interview_id = p_interview_id
          AND owned_session.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    RETURN QUERY
    SELECT r.id, r.status, r.overall_score, r.score_breakdown, r.strengths, r.improvement_summary, r.scoring_version, r.publication_version, r.generated_at, r.created_at, r.updated_at
    FROM public.interview_session_results r
    WHERE r.session_id = p_session_id AND r.interview_id = p_interview_id AND r.user_id = v_user_id
    ORDER BY r.publication_version DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'RESOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
END;
$$;
ALTER FUNCTION public.student_get_latest_session_result(uuid, uuid) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.student_get_latest_session_result(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.student_get_latest_session_result(uuid, uuid) FROM PUBLIC, anon, service_role;
