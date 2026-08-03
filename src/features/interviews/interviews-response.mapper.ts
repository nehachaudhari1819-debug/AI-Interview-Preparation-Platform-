import type {
  InterviewDetail,
  InterviewSession,
  SessionQuestion,
  AnswerDetail,
} from "./interviews.types.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
  DbAnswer,
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
  const configSnapshot = row.config_snapshot;
  const safeConfig = {
    title: configSnapshot.title,
    targetRole: configSnapshot.targetRole,
    questionCount: configSnapshot.questionCount,
    timeLimitMinutes: configSnapshot.timeLimitMinutes,
    interviewType: configSnapshot.interviewType,
    difficulty: configSnapshot.difficulty,
    skills: configSnapshot.skills,
    topics: configSnapshot.topics,
  };

  return {
    id: row.id,
    interviewId: row.interview_id,
    status: row.status,
    configSnapshot: safeConfig,
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
  const taxSnapshot = row.taxonomy_snapshot;
  const safeTaxonomy = taxSnapshot
    ? {
        question_categories: taxSnapshot.question_categories,
        question_difficulties: taxSnapshot.question_difficulties,
        question_interview_types: taxSnapshot.question_interview_types,
      }
    : null;

  return {
    id: row.id,
    sessionId: row.session_id,
    displayOrder: row.display_order,
    questionTextSnapshot: row.question_text_snapshot,
    taxonomySnapshot: safeTaxonomy,
    createdAt: row.created_at,
  };
}

export function mapAnswerToResponse(row: DbAnswer): AnswerDetail {
  return {
    id: row.id,
    sessionQuestionId: row.sessionQuestionId,
    responseType: row.responseType,
    textResponse: row.textResponse,
    codeResponse: row.codeResponse
      ? {
          source: row.codeResponse.source,
          language: row.codeResponse.language,
          explanation: row.codeResponse.explanation,
        }
      : null,
    status: row.status,
    version: row.version,
    finalizedAt: row.finalizedAt,
    skippedAt: row.skippedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
