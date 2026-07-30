import type { InterviewDetail, InterviewSession, SessionQuestion } from "./interviews.types.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
} from "../../persistence/interviews/supabase-interviews.repository.js";
import { InternalServerError } from "../../errors/internal-server.error.js";

export function mapInterviewToResponse(row: DbInterview): InterviewDetail {
  if (!row.question_interview_types || !row.question_difficulties) {
    throw new InternalServerError("Missing required taxonomy relations for interview");
  }

  return {
    id: row.id,
    title: row.title,
    targetRole: row.target_role,
    questionCount: row.question_count,
    timeLimitMinutes: row.time_limit_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    interviewType: {
      id: row.question_interview_types.id,
      name: row.question_interview_types.name,
    },
    difficulty: {
      id: row.question_difficulties.id,
      name: row.question_difficulties.name,
    },
    skills: row.interview_skill_mappings.flatMap((m) =>
      m.question_skills
        ? [
            {
              id: m.question_skills.id,
              name: m.question_skills.name,
            },
          ]
        : [],
    ),
    topics: row.interview_topic_mappings.flatMap((m) =>
      m.question_topics
        ? [
            {
              id: m.question_topics.id,
              name: m.question_topics.name,
            },
          ]
        : [],
    ),
  };
}

export function mapSessionToResponse(row: DbSession): InterviewSession {
  return {
    id: row.id,
    interviewId: row.interview_id,
    status: row.status,
    configSnapshot: row.config_snapshot,
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    totalPausedSeconds: row.total_paused_seconds,
    completedAt: row.completed_at,
    lastTransitionAt: row.last_transition_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSessionQuestionToResponse(row: DbSessionQuestion): SessionQuestion {
  return {
    id: row.id,
    sessionId: row.session_id,
    displayOrder: row.display_order,
    questionTextSnapshot: row.question_text_snapshot,
    taxonomySnapshot: row.taxonomy_snapshot,
    createdAt: row.created_at,
  };
}
