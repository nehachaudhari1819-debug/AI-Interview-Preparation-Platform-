-- Migration 21: Phase 5.2 Interview Session Foundation

-- Enum
CREATE TYPE public.interview_session_status_enum AS ENUM ('ready', 'in_progress', 'paused', 'completed');
REVOKE ALL ON TYPE public.interview_session_status_enum FROM PUBLIC, anon;
GRANT USAGE ON TYPE public.interview_session_status_enum TO authenticated, service_role;

-- interviews (Configuration)
CREATE TABLE public.interviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    title varchar(100) NOT NULL CHECK (btrim(title) <> ''),
    target_role varchar(100) NOT NULL CHECK (btrim(target_role) <> ''),
    interview_type_id uuid NOT NULL REFERENCES public.question_interview_types(id) ON DELETE RESTRICT,
    difficulty_id uuid NOT NULL REFERENCES public.question_difficulties(id) ON DELETE RESTRICT,
    question_count integer NOT NULL CHECK (question_count BETWEEN 1 AND 20),
    time_limit_minutes integer CHECK (time_limit_minutes BETWEEN 5 AND 120),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT interviews_id_user_id_key UNIQUE (id, user_id)
);

-- interview_skill_mappings
CREATE TABLE public.interview_skill_mappings (
    interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE RESTRICT,
    skill_id uuid NOT NULL REFERENCES public.question_skills(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (interview_id, skill_id)
);

-- interview_topic_mappings
CREATE TABLE public.interview_topic_mappings (
    interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE RESTRICT,
    topic_id uuid NOT NULL REFERENCES public.question_topics(id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (interview_id, topic_id)
);

-- interview_sessions
CREATE TABLE public.interview_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    status public.interview_session_status_enum NOT NULL DEFAULT 'ready',
    config_snapshot jsonb NOT NULL CHECK (jsonb_typeof(config_snapshot) = 'object'),
    config_snapshot_version integer NOT NULL DEFAULT 1 CHECK (config_snapshot_version > 0),
    started_at timestamptz,
    paused_at timestamptz,
    total_paused_seconds integer NOT NULL DEFAULT 0 CHECK (total_paused_seconds >= 0),
    completed_at timestamptz,
    last_transition_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT interview_sessions_interview_id_user_id_fkey FOREIGN KEY (interview_id, user_id) REFERENCES public.interviews(id, user_id) ON DELETE RESTRICT,

    CHECK (
        (status = 'ready' AND started_at IS NULL AND paused_at IS NULL AND completed_at IS NULL AND total_paused_seconds = 0) OR
        (status IN ('in_progress', 'paused', 'completed') AND started_at IS NOT NULL)
    ),
    CHECK (
        (status = 'paused' AND paused_at IS NOT NULL) OR
        (status != 'paused' AND paused_at IS NULL)
    ),
    CHECK (
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status != 'completed' AND completed_at IS NULL)
    ),
    CHECK (completed_at >= started_at),
    CHECK (last_transition_at >= created_at),
    CHECK (updated_at >= created_at)
);

-- interview_session_questions
CREATE TABLE public.interview_session_questions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.interview_sessions(id) ON DELETE RESTRICT,
    question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
    display_order integer NOT NULL CHECK (display_order > 0),
    question_text_snapshot text NOT NULL CHECK (btrim(question_text_snapshot) <> ''),
    taxonomy_snapshot jsonb NOT NULL CHECK (jsonb_typeof(taxonomy_snapshot) = 'object'),
    question_snapshot_version integer NOT NULL DEFAULT 1 CHECK (question_snapshot_version > 0),
    created_at timestamptz NOT NULL DEFAULT now(),

    UNIQUE (session_id, display_order),
    UNIQUE (session_id, question_id)
);

-- Active Session Uniqueness
CREATE UNIQUE INDEX idx_interview_sessions_active_session ON public.interview_sessions(interview_id) WHERE status != 'completed';

-- Indexes
CREATE INDEX idx_interviews_user_created_at ON public.interviews(user_id, created_at DESC);
CREATE INDEX idx_interview_skill_mappings_skill_id ON public.interview_skill_mappings(skill_id);
CREATE INDEX idx_interview_topic_mappings_topic_id ON public.interview_topic_mappings(topic_id);
CREATE INDEX idx_interview_sessions_user_created_at ON public.interview_sessions(user_id, created_at DESC);
CREATE INDEX idx_interview_sessions_interview_created_at ON public.interview_sessions(interview_id, created_at DESC);
CREATE INDEX idx_interview_session_questions_question_id ON public.interview_session_questions(question_id);

-- Ownership integrity triggers
CREATE OR REPLACE FUNCTION private.enforce_interview_session_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Session id is immutable';
    END IF;
    IF NEW.interview_id IS DISTINCT FROM OLD.interview_id THEN
        RAISE EXCEPTION 'Session interview_id is immutable';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'Session user_id is immutable';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Session created_at is immutable';
    END IF;
    IF NEW.config_snapshot IS DISTINCT FROM OLD.config_snapshot THEN
        RAISE EXCEPTION 'Session config_snapshot is immutable';
    END IF;
    IF NEW.config_snapshot_version IS DISTINCT FROM OLD.config_snapshot_version THEN
        RAISE EXCEPTION 'Session config_snapshot_version is immutable';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_interview_session_immutable_fields() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.enforce_interview_session_immutable_fields() TO service_role;

CREATE TRIGGER enforce_interview_session_immutable
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW
    EXECUTE FUNCTION private.enforce_interview_session_immutable_fields();

-- trigger to prevent ANY update or delete on interview_session_questions
CREATE OR REPLACE FUNCTION private.prevent_interview_session_question_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Interview session questions are strictly immutable and cannot be updated or deleted.';
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_interview_session_question_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prevent_interview_session_question_mutation() TO service_role;

CREATE TRIGGER enforce_interview_session_question_immutable_update
    BEFORE UPDATE ON public.interview_session_questions
    FOR EACH ROW
    EXECUTE FUNCTION private.prevent_interview_session_question_mutation();

CREATE TRIGGER enforce_interview_session_question_immutable_delete
    BEFORE DELETE ON public.interview_session_questions
    FOR EACH ROW
    EXECUTE FUNCTION private.prevent_interview_session_question_mutation();

-- trigger for updated_at
CREATE TRIGGER set_interviews_updated_at
    BEFORE UPDATE ON public.interviews
    FOR EACH ROW
    WHEN (
        OLD.title IS DISTINCT FROM NEW.title OR
        OLD.target_role IS DISTINCT FROM NEW.target_role OR
        OLD.interview_type_id IS DISTINCT FROM NEW.interview_type_id OR
        OLD.difficulty_id IS DISTINCT FROM NEW.difficulty_id OR
        OLD.question_count IS DISTINCT FROM NEW.question_count OR
        OLD.time_limit_minutes IS DISTINCT FROM NEW.time_limit_minutes
    )
    EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER set_interview_sessions_updated_at
    BEFORE UPDATE ON public.interview_sessions
    FOR EACH ROW
    WHEN (
        OLD.status IS DISTINCT FROM NEW.status OR
        OLD.started_at IS DISTINCT FROM NEW.started_at OR
        OLD.paused_at IS DISTINCT FROM NEW.paused_at OR
        OLD.total_paused_seconds IS DISTINCT FROM NEW.total_paused_seconds OR
        OLD.completed_at IS DISTINCT FROM NEW.completed_at OR
        OLD.last_transition_at IS DISTINCT FROM NEW.last_transition_at
    )
    EXECUTE FUNCTION private.set_updated_at();

-- Enable RLS
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_topic_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_session_questions ENABLE ROW LEVEL SECURITY;

-- Grants (Explicit hardened grants and revokes)
REVOKE ALL ON public.interviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interview_skill_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interview_topic_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interview_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.interview_session_questions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.interviews TO authenticated;
GRANT SELECT ON public.interview_skill_mappings TO authenticated;
GRANT SELECT ON public.interview_topic_mappings TO authenticated;
GRANT SELECT ON public.interview_sessions TO authenticated;
GRANT SELECT ON public.interview_session_questions TO authenticated;

GRANT ALL ON public.interviews TO service_role;
GRANT ALL ON public.interview_skill_mappings TO service_role;
GRANT ALL ON public.interview_topic_mappings TO service_role;
GRANT ALL ON public.interview_sessions TO service_role;
GRANT ALL ON public.interview_session_questions TO service_role;

-- RLS Policies
CREATE POLICY interviews_student_read ON public.interviews FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) AND (SELECT public.get_current_account_access_state()) = 'active'
);

CREATE POLICY interview_skill_mappings_student_read ON public.interview_skill_mappings FOR SELECT TO authenticated USING (
    interview_id IN (SELECT id FROM public.interviews WHERE user_id = (SELECT auth.uid())) AND (SELECT public.get_current_account_access_state()) = 'active'
);

CREATE POLICY interview_topic_mappings_student_read ON public.interview_topic_mappings FOR SELECT TO authenticated USING (
    interview_id IN (SELECT id FROM public.interviews WHERE user_id = (SELECT auth.uid())) AND (SELECT public.get_current_account_access_state()) = 'active'
);

CREATE POLICY interview_sessions_student_read ON public.interview_sessions FOR SELECT TO authenticated USING (
    user_id = (SELECT auth.uid()) AND (SELECT public.get_current_account_access_state()) = 'active'
);

CREATE POLICY interview_session_questions_student_read ON public.interview_session_questions FOR SELECT TO authenticated USING (
    (SELECT public.get_current_account_access_state()) = 'active' AND
    EXISTS (
        SELECT 1 FROM public.interview_sessions AS session
        WHERE session.id = interview_session_questions.session_id
          AND session.user_id = (SELECT auth.uid())
          AND session.status IN ('in_progress', 'paused', 'completed')
    )
);
