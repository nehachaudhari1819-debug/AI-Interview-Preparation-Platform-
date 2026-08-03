import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database as GeneratedDatabase, Json } from "../database.types.js";
import type { CodeResponse } from "../../features/interviews/interviews.types.js";
import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  GetInterviewsQuery,
  GetSessionsQuery,
  SaveDraftAnswerBody,
  UpdateDraftAnswerBody,
  FinalizeAnswerBody,
} from "../../features/interviews/interviews.schemas.js";
import type { IInterviewsRepository } from "../../features/interviews/interviews.repository.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { z } from "zod";

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
  } else if (code === "P0006") {
    throw new PersistenceError(
      PersistenceErrorCode.IDEMPOTENCY_IN_PROGRESS,
      "Idempotency in progress",
    );
  } else if (code === "P0007") {
    throw new PersistenceError(PersistenceErrorCode.IDEMPOTENCY_CONFLICT, "Idempotency conflict");
  } else if (code === "P0008") {
    throw new PersistenceError(
      PersistenceErrorCode.INSUFFICIENT_ELIGIBLE_QUESTIONS,
      "Insufficient eligible questions",
    );
  } else if (code === "P0011") {
    throw new PersistenceError(PersistenceErrorCode.SESSION_TERMINAL, "Session is not in progress");
  } else if (code === "P0012") {
    throw new PersistenceError(
      PersistenceErrorCode.STALE_UPDATE_CONFLICT,
      "Answer has been updated by another request",
    );
  } else if (code === "P0013") {
    throw new PersistenceError(
      PersistenceErrorCode.ANSWER_IMMUTABLE,
      "Finalized answers cannot be modified",
    );
  } else if (code === "P0014") {
    throw new PersistenceError(
      PersistenceErrorCode.ANSWER_SKIPPED,
      "Skipped answers cannot be modified",
    );
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
  status: "ready" | "in_progress" | "paused" | "completed";
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

export interface DbAnswer {
  id: string;
  sessionQuestionId: string;
  responseType: "text" | "code" | null;
  textResponse: string | null;
  codeResponse: {
    source: string;
    language: string;
    explanation: string;
  } | null;
  status: "draft" | "finalized" | "skipped";
  version: number;
  finalizedAt: string | null;
  skippedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const mapCodeResponseToJson = (value: CodeResponse): Json => ({
  source: value.source,
  language: value.language,
  explanation: value.explanation,
});

const RpcAnswerRowSchema = z
  .object({
    id: z.uuid(),
    session_question_id: z.uuid(),
    response_type: z.enum(["text", "code"]).nullable(),
    text_response: z.string().nullable(),
    code_response: z
      .object({
        source: z.string(),
        language: z.string(),
        explanation: z.string(),
      })
      .nullable(),
    status: z.enum(["draft", "finalized", "skipped"]),
    version: z.number().int().positive(),
    finalized_at: z.string().nullable(),
    skipped_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .strict();

export class SupabaseInterviewsRepository implements IInterviewsRepository {
  constructor(private readonly supabase: SupabaseClient<GeneratedDatabase>) {}

  public async createInterview(data: CreateInterviewBody): Promise<string> {
    const { data: id, error } = await this.supabase.rpc("student_create_interview_config", {
      p_title: data.title,
      p_target_role: data.targetRole,
      p_interview_type_id: data.interviewTypeId,
      p_difficulty_id: data.difficultyId,
      p_question_count: data.questionCount,
      p_time_limit_minutes: (data.timeLimitMinutes ?? null) as unknown as number,
      p_skill_ids: data.skillIds,
      p_topic_ids: data.topicIds || [],
    });

    if (error) {
      normalizeRpcError(error);
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
    query: GetSessionsQuery,
  ): Promise<{ sessions: DbSession[]; total: number }> {
    const { page, limit, sortBy, sortDir, status, createdFrom, createdTo } = query;
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
      .eq("interview_id", interviewId);

    if (status && status.length > 0) {
      dbQuery = dbQuery.in("status", status);
    }
    if (createdFrom) {
      dbQuery = dbQuery.gte("created_at", createdFrom);
    }
    if (createdTo) {
      dbQuery = dbQuery.lte("created_at", createdTo);
    }

    const orderColumn = sortBy === "createdAt" ? "created_at" : "updated_at";

    dbQuery = dbQuery
      .order(orderColumn, { ascending: sortDir === "asc", nullsFirst: false })
      .order("id", { ascending: sortDir === "asc" });

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
  ): Promise<DbSessionQuestion[]> {
    const dbQuery = this.supabase
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
      .eq("session_id", sessionId)
      .eq("interview_sessions.interview_id", interviewId) // Chain ownership explicitly
      .order("display_order", { ascending: true });

    const { data, error } = await dbQuery.overrideTypes<DbSessionQuestion[], { merge: false }>();

    if (error) {
      throw new PersistenceError(
        PersistenceErrorCode.OPERATION_FAILED,
        "Failed to fetch session questions",
      );
    }

    return data;
  }

  public async listSessionAnswers(interviewId: string, sessionId: string): Promise<DbAnswer[]> {
    const { data, error } = await this.supabase.rpc("student_list_session_answers", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
    });

    if (error) {
      normalizeRpcError(error);
    }

    const rows = z.array(RpcAnswerRowSchema).parse(data);

    return rows.map((row) => ({
      id: row.id,
      sessionQuestionId: row.session_question_id,
      responseType: row.response_type,
      textResponse: row.text_response,
      codeResponse: row.code_response,
      status: row.status,
      version: row.version,
      finalizedAt: row.finalized_at,
      skippedAt: row.skipped_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async getSessionAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbAnswer> {
    const { data, error } = await this.supabase.rpc("student_get_session_answer", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_session_question_id: sessionQuestionId,
    });

    if (error) {
      normalizeRpcError(error);
    }

    if (data.length === 0) {
      throw new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Answer not found");
    }

    const row = RpcAnswerRowSchema.parse(data[0]);

    return {
      id: row.id,
      sessionQuestionId: row.session_question_id,
      responseType: row.response_type,
      textResponse: row.text_response,
      codeResponse: row.code_response,
      status: row.status,
      version: row.version,
      finalizedAt: row.finalized_at,
      skippedAt: row.skipped_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
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
      normalizeRpcError(error);
    }

    return data;
  }

  public async createSession(
    interviewId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    const { data, error } = await this.supabase.rpc("student_create_interview_session", {
      p_interview_id: interviewId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseCreateSessionResult(data);
  }

  public async startSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    const { data, error } = await this.supabase.rpc("student_start_interview_session", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseLifecycleResult(data);
  }

  public async pauseSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    const { data, error } = await this.supabase.rpc("student_pause_interview_session", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseLifecycleResult(data);
  }

  public async resumeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    const { data, error } = await this.supabase.rpc("student_resume_interview_session", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseLifecycleResult(data);
  }

  public async completeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    const { data, error } = await this.supabase.rpc("student_complete_interview_session", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseLifecycleResult(data);
  }

  public async saveDraftAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: SaveDraftAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }> {
    const { data: result, error } = await this.supabase.rpc("student_save_draft_answer", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_session_question_id: sessionQuestionId,
      p_response_type: data.responseType,
      p_text_response: (data.responseType === "text"
        ? data.textResponse
        : null) as unknown as string,
      p_code_response:
        data.responseType === "code" ? mapCodeResponseToJson(data.codeResponse) : null,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseAnswerResult(result, 201);
  }

  public async updateDraftAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: UpdateDraftAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }> {
    const { data: result, error } = await this.supabase.rpc("student_update_draft_answer", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_session_question_id: sessionQuestionId,
      p_expected_version: data.expectedVersion,
      p_text_response: (data.responseType === "text"
        ? data.textResponse
        : null) as unknown as string,
      p_code_response:
        data.responseType === "code" ? mapCodeResponseToJson(data.codeResponse) : null,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseAnswerResult(result, 200);
  }

  public async finalizeAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: FinalizeAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }> {
    const { data: result, error } = await this.supabase.rpc("student_finalize_answer", {
      p_interview_id: interviewId,
      p_session_id: sessionId,
      p_session_question_id: sessionQuestionId,
      p_expected_version: data.expectedVersion,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (error) normalizeRpcError(error);
    return parseAnswerResult(result, 200);
  }
}

const SessionSnapshotSchema = z
  .object({
    id: z.uuid(),
    interview_id: z.uuid(),
    user_id: z.uuid(),
    status: z.enum(["ready", "in_progress", "paused", "completed"]),
    config_snapshot: z.record(z.string(), z.unknown()),
    config_snapshot_version: z.number().int().positive(),
    started_at: z.iso.datetime({ offset: true }).nullable(),
    paused_at: z.iso.datetime({ offset: true }).nullable(),
    total_paused_seconds: z.number().int().nonnegative(),
    completed_at: z.iso.datetime({ offset: true }).nullable(),
    last_transition_at: z.iso.datetime({ offset: true }),
    created_at: z.iso.datetime({ offset: true }),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const LifecycleResultSchema = z
  .object({
    replayed: z.boolean(),
    response_status: z.literal(200),
    snapshot: SessionSnapshotSchema,
  })
  .strict();

const CreateSessionResultSchema = z
  .object({
    replayed: z.boolean(),
    response_status: z.literal(201),
    snapshot: SessionSnapshotSchema,
  })
  .strict();

function parseLifecycleResult(data: unknown): { replayed: boolean; snapshot: DbSession } {
  const result = LifecycleResultSchema.safeParse(data);
  if (!result.success) {
    throw new PersistenceError(
      PersistenceErrorCode.OPERATION_FAILED,
      "Invalid lifecycle response envelope",
      result.error,
    );
  }
  return {
    replayed: result.data.replayed,
    snapshot: result.data.snapshot,
  };
}

function parseCreateSessionResult(data: unknown): { replayed: boolean; snapshot: DbSession } {
  const result = CreateSessionResultSchema.safeParse(data);

  if (!result.success) {
    throw new PersistenceError(
      PersistenceErrorCode.OPERATION_FAILED,
      "Invalid create-session response envelope",
      result.error,
    );
  }

  return {
    replayed: result.data.replayed,
    snapshot: result.data.snapshot,
  };
}

const AnswerSnapshotSchema = z
  .object({
    id: z.uuid(),
    sessionQuestionId: z.uuid(),
    responseType: z.enum(["text", "code"]).nullable(),
    textResponse: z.string().nullable(),
    codeResponse: z
      .object({
        source: z.string(),
        language: z.string(),
        explanation: z.string(),
      })
      .nullable(),
    status: z.enum(["draft", "finalized", "skipped"]),
    version: z.number().int().positive(),
    finalizedAt: z.iso.datetime({ offset: true }).nullable(),
    skippedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

const AnswerResultSchema201 = z
  .object({
    replayed: z.boolean(),
    response_status: z.literal(201),
    snapshot: AnswerSnapshotSchema,
  })
  .strict();

const AnswerResultSchema200 = z
  .object({
    replayed: z.boolean(),
    response_status: z.literal(200),
    snapshot: AnswerSnapshotSchema,
  })
  .strict();

function parseAnswerResult(
  data: unknown,
  expectedStatus: 200 | 201,
): { replayed: boolean; snapshot: DbAnswer } {
  const schema = expectedStatus === 201 ? AnswerResultSchema201 : AnswerResultSchema200;
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new PersistenceError(
      PersistenceErrorCode.OPERATION_FAILED,
      "Invalid answer response envelope",
      result.error,
    );
  }
  return {
    replayed: result.data.replayed,
    snapshot: result.data.snapshot,
  };
}
