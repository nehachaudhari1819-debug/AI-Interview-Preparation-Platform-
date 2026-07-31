import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  GetInterviewsQuery,
  PaginationQuery,
} from "./interviews.schemas.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
} from "../../persistence/interviews/supabase-interviews.repository.js";

export interface IInterviewsRepository {
  createInterview(data: CreateInterviewBody): Promise<string>; // Returns UUID
  updateInterview(id: string, data: UpdateInterviewBody): Promise<string>; // Returns UUID

  getInterviews(query: GetInterviewsQuery): Promise<{ interviews: DbInterview[]; total: number }>;
  getInterviewById(id: string): Promise<DbInterview | null>;

  getInterviewSessions(
    interviewId: string,
    query: PaginationQuery,
  ): Promise<{ sessions: DbSession[]; total: number }>;
  getInterviewSessionById(interviewId: string, sessionId: string): Promise<DbSession | null>;

  getSessionQuestions(
    interviewId: string,
    sessionId: string,
    query: PaginationQuery,
  ): Promise<{ questions: DbSessionQuestion[]; total: number }>;
  getSessionQuestionById(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbSessionQuestion | null>;

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
}
