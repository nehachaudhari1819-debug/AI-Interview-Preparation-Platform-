import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  GetInterviewsQuery,
  GetSessionsQuery,
  SaveDraftAnswerBody,
  UpdateDraftAnswerBody,
  FinalizeAnswerBody,
} from "./interviews.schemas.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
  DbAnswer,
} from "../../persistence/interviews/supabase-interviews.repository.js";

export interface IInterviewsRepository {
  createInterview(data: CreateInterviewBody): Promise<string>; // Returns UUID
  updateInterview(id: string, data: UpdateInterviewBody): Promise<string>; // Returns UUID

  getInterviews(query: GetInterviewsQuery): Promise<{ interviews: DbInterview[]; total: number }>;
  getInterviewById(id: string): Promise<DbInterview | null>;

  getInterviewSessions(
    interviewId: string,
    query: GetSessionsQuery,
  ): Promise<{ sessions: DbSession[]; total: number }>;
  getInterviewSessionById(interviewId: string, sessionId: string): Promise<DbSession | null>;

  getSessionQuestions(interviewId: string, sessionId: string): Promise<DbSessionQuestion[]>;
  getSessionQuestionById(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbSessionQuestion | null>;

  listSessionAnswers(interviewId: string, sessionId: string): Promise<DbAnswer[]>;
  getSessionAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbAnswer>;

  createSession(
    interviewId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;

  startSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  pauseSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  resumeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  completeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;

  // P6.3 — Answer mutations
  saveDraftAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: SaveDraftAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }>;

  updateDraftAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: UpdateDraftAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }>;

  finalizeAnswer(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
    data: FinalizeAnswerBody,
    idempotencyKey: string,
    requestHash: string,
  ): Promise<{ replayed: boolean; snapshot: DbAnswer }>;
}
