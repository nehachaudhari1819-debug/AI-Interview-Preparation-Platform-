import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types.js";
import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  GetInterviewsQuery,
  PaginationQuery,
} from "../../features/interviews/interviews.schemas.js";
import type { IInterviewsRepository } from "../../features/interviews/interviews.repository.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";

// Helper to extract Postgres errors from PostgREST/RPC failures
function normalizeRpcError(error: unknown): never {
  const err = error as { code?: string; message?: string } | null | undefined;
  const code = err?.code || "";
  if (code === "P0001") {
    throw new PersistenceError(PersistenceErrorCode.UNAUTHORIZED_ACCESS, "Forbidden access");
  } else if (code === "P0002") {
    throw new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Resource not found");
  } else if (code === "P0003") {
    throw new PersistenceError(PersistenceErrorCode.RECORD_UPDATE_CONFLICT, "Resource conflict");
  } else if (code === "P0004") {
    throw new PersistenceError(PersistenceErrorCode.VALIDATION_FAILED, "Validation error");
  }
  throw new PersistenceError(
    PersistenceErrorCode.OPERATION_FAILED,
    err?.message || "Unknown error",
    error,
  );
}

// Temporary types for the Supabase queries before mapping
export interface DbInterview {
  id: string;
  title: string;
  target_role: string;
  question_count: number;
  time_limit_minutes: number | null;
  created_at: string;
  updated_at: string;
  question_interview_types: { id: string; name: string } | null;
  question_difficulties: { id: string; name: string } | null;
  interview_skill_mappings: { question_skills: { id: string; name: string } | null }[];
  interview_topic_mappings: { question_topics: { id: string; name: string } | null }[];
}

export interface DbSession {
  id: string;
  interview_id: string;
  status: "ready" | "in_progress" | "paused" | "completed" | "expired";
  config_snapshot: Record<string, unknown>;
  started_at: string | null;
  paused_at: string | null;
  total_paused_seconds: number;
  completed_at: string | null;
  last_transition_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbSessionQuestion {
  id: string;
  session_id: string;
  display_order: number;
  question_text_snapshot: string | null;
  taxonomy_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export class SupabaseInterviewsRepository implements IInterviewsRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  public async createInterview(data: CreateInterviewBody): Promise<string> {
    const { data: id, error } = await this.supabase.rpc("student_create_interview_config", {
      p_title: data.title,
      p_target_role: data.targetRole,
      p_interview_type_id: data.interviewTypeId,
      p_difficulty_id: data.difficultyId,
      p_question_count: data.questionCount,
      p_time_limit_minutes: (data.timeLimitMinutes ?? null) as unknown as number, // ensure null instead of undefined
      p_skill_ids: data.skillIds,
      p_topic_ids: data.topicIds || [],
    });

    if (error) {
      normalizeRpcError(error);
    }

    if (!id) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to create interview: Missing ID",
      );
    }

    return id;
  }

  public async updateInterview(id: string, data: UpdateInterviewBody): Promise<string> {
    const { data: updatedId, error } = await this.supabase.rpc("student_update_interview_config", {
      p_interview_id: id,
      p_expected_updated_at: data.expectedUpdatedAt,
      p_update_payload: data.payload,
    });

    if (error) {
      normalizeRpcError(error);
    }

    if (!updatedId) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to update interview: Missing ID",
      );
    }

    return updatedId;
  }

  public async getInterviews(
    query: GetInterviewsQuery,
  ): Promise<{ interviews: DbInterview[]; total: number }> {
    const { page, limit, sortBy, sortDir } = query;

    let dbQuery = this.supabase.from("interviews").select(
      `
        id, title, target_role, question_count, time_limit_minutes, created_at, updated_at,
        question_interview_types(id, name),
        question_difficulties(id, name),
        interview_skill_mappings(
          question_skills(id, name)
        ),
        interview_topic_mappings(
          question_topics(id, name)
        )
      `,
      { count: "exact" },
    );

    const orderColumn = sortBy === "createdAt" ? "created_at" : "updated_at";

    dbQuery = dbQuery
      .order(orderColumn, { ascending: sortDir === "asc", nullsFirst: false })
      .order("id", { ascending: true }); // deterministic tiebreaker

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, count, error } = await dbQuery.overrideTypes<DbInterview[], { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch interviews",
      );
    }

    return {
      interviews: data,
      total: count ?? 0,
    };
  }

  public async getInterviewById(id: string): Promise<DbInterview | null> {
    const { data, error } = await this.supabase
      .from("interviews")
      .select(
        `
        id, title, target_role, question_count, time_limit_minutes, created_at, updated_at,
        question_interview_types(id, name),
        question_difficulties(id, name),
        interview_skill_mappings(
          question_skills(id, name)
        ),
        interview_topic_mappings(
          question_topics(id, name)
        )
      `,
      )
      .eq("id", id)
      .maybeSingle()
      .overrideTypes<DbInterview, { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch interview detail",
      );
    }

    if (!data) return null;
    return data;
  }

  public async getInterviewSessions(
    interviewId: string,
    query: PaginationQuery,
  ): Promise<{ sessions: DbSession[]; total: number }> {
    // Note: Implicit auth.uid() filtering happens via RLS. But we need to ensure the parent interview is owned by the user.
    // If the interview isn't owned, we won't see its sessions due to RLS, or we can enforce it explicitly.
    // However, the instructions say "Nested resource queries must validate the complete ownership chain".
    // We can do this safely by joining the interviews table (which has user_id ownership enforced by RLS).

    const { page, limit } = query;
    let dbQuery = this.supabase
      .from("interview_sessions")
      .select(
        `
        id, interview_id, status, config_snapshot, started_at, paused_at,
        total_paused_seconds, completed_at, last_transition_at, created_at, updated_at,
        interviews!inner(id)
      `,
        { count: "exact" },
      )
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }); // deterministic

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, count, error } = await dbQuery.overrideTypes<DbSession[], { merge: false }>();

    if (error) {
      throw new PersistenceError(PersistenceErrorCode.OPERATION_FAILED, "Failed to fetch sessions");
    }

    return {
      sessions: data,
      total: count ?? 0,
    };
  }

  public async getInterviewSessionById(
    interviewId: string,
    sessionId: string,
  ): Promise<DbSession | null> {
    const { data, error } = await this.supabase
      .from("interview_sessions")
      .select(
        `
        id, interview_id, status, config_snapshot, started_at, paused_at,
        total_paused_seconds, completed_at, last_transition_at, created_at, updated_at,
        interviews!inner(id)
      `,
      )
      .eq("id", sessionId)
      .eq("interview_id", interviewId)
      .maybeSingle()
      .overrideTypes<DbSession, { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch session detail",
      );
    }

    if (!data) return null;
    return data;
  }

  public async getSessionQuestions(
    interviewId: string,
    sessionId: string,
    query: PaginationQuery,
  ): Promise<{ questions: DbSessionQuestion[]; total: number }> {
    const { page, limit } = query;
    let dbQuery = this.supabase
      .from("interview_session_questions")
      .select(
        `
        id, session_id, display_order, question_text_snapshot, taxonomy_snapshot, created_at,
        interview_sessions!inner(
          id,
          interview_id,
          interviews!inner(id)
        )
      `,
        { count: "exact" },
      )
      .eq("session_id", sessionId)
      .eq("interview_sessions.interview_id", interviewId) // Chain ownership explicitly
      .order("display_order", { ascending: true });

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, count, error } = await dbQuery.overrideTypes<
      DbSessionQuestion[],
      { merge: false }
    >();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch session questions",
      );
    }

    return {
      questions: data,
      total: count ?? 0,
    };
  }

  public async getSessionQuestionById(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbSessionQuestion | null> {
    const { data, error } = await this.supabase
      .from("interview_session_questions")
      .select(
        `
        id, session_id, display_order, question_text_snapshot, taxonomy_snapshot, created_at,
        interview_sessions!inner(
          id,
          interview_id,
          interviews!inner(id)
        )
      `,
      )
      .eq("id", sessionQuestionId)
      .eq("session_id", sessionId)
      .eq("interview_sessions.interview_id", interviewId)
      .maybeSingle()
      .overrideTypes<DbSessionQuestion, { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch session question detail",
      );
    }

    if (!data) return null;
    return data;
  }
}
