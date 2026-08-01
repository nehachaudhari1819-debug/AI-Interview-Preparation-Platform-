import type { IInterviewsRepository } from "./interviews.repository.js";
import type {
  DbInterview,
  DbSession,
  DbSessionQuestion,
} from "../../persistence/interviews/supabase-interviews.repository.js";
import type {
  CreateInterviewBody,
  UpdateInterviewBody,
  GetInterviewsQuery,
  GetSessionsQuery,
} from "./interviews.schemas.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import { AppError } from "../../errors/app-error.js";
import { ForbiddenError } from "../../errors/forbidden.error.js";
import { InternalServerError } from "../../errors/internal-server.error.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { ERROR_CODES } from "../../constants/error-codes.constants.js";
import { PersistenceError, PersistenceErrorCode } from "../../persistence/persistence-error.js";
import { generateRequestFingerprint } from "../../domain/idempotency/request-fingerprint.js";

export interface PaginatedInterviewsResult {
  items: DbInterview[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PaginatedSessionsResult {
  items: DbSession[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PaginatedSessionQuestionsResult {
  items: DbSessionQuestion[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface IInterviewsService {
  createInterview(data: CreateInterviewBody): Promise<DbInterview>;
  updateInterview(id: string, data: UpdateInterviewBody): Promise<DbInterview>;
  getInterviews(query: GetInterviewsQuery): Promise<PaginatedInterviewsResult>;
  getInterviewById(id: string): Promise<DbInterview>;
  getInterviewSessions(
    interviewId: string,
    query: GetSessionsQuery,
  ): Promise<PaginatedSessionsResult>;
  getInterviewSessionById(interviewId: string, sessionId: string): Promise<DbSession>;
  getSessionQuestions(interviewId: string, sessionId: string): Promise<DbSessionQuestion[]>;
  getSessionQuestionById(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbSessionQuestion>;

  createSession(
    interviewId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;

  startSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  pauseSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  resumeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
  completeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }>;
}

export class InterviewsService implements IInterviewsService {
  constructor(private readonly repository: IInterviewsRepository) {}

  public async createInterview(data: CreateInterviewBody): Promise<DbInterview> {
    try {
      const id = await this.repository.createInterview(data);
      const interview = await this.repository.getInterviewById(id);
      if (!interview) {
        throw new InternalServerError("Created interview could not be retrieved");
      }
      return interview;
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.UNAUTHORIZED_ACCESS)) {
        throw new ForbiddenError(error.message);
      }
      if (PersistenceError.is(error, PersistenceErrorCode.VALIDATION_FAILED)) {
        throw new AppError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  }

  public async updateInterview(id: string, data: UpdateInterviewBody): Promise<DbInterview> {
    try {
      const updatedId = await this.repository.updateInterview(id, data);
      const interview = await this.repository.getInterviewById(updatedId);
      if (!interview) {
        throw new InternalServerError("Updated interview could not be retrieved");
      }
      return interview;
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.UNAUTHORIZED_ACCESS)) {
        throw new ForbiddenError(error.message);
      }
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.VALIDATION_FAILED)) {
        throw new AppError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: ERROR_CODES.VALIDATION_ERROR,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)) {
        throw new NotFoundError(error.message);
      }
      throw error;
    }
  }

  public async getInterviews(query: GetInterviewsQuery): Promise<PaginatedInterviewsResult> {
    const { interviews, total } = await this.repository.getInterviews(query);
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      items: interviews,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  public async getInterviewById(id: string): Promise<DbInterview> {
    const interview = await this.repository.getInterviewById(id);
    if (!interview) {
      throw new NotFoundError("Interview not found");
    }
    return interview;
  }

  public async getInterviewSessions(
    interviewId: string,
    query: GetSessionsQuery,
  ): Promise<PaginatedSessionsResult> {
    // Verify the interview exists and belongs to the user
    await this.getInterviewById(interviewId);

    const { sessions, total } = await this.repository.getInterviewSessions(interviewId, query);
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    return {
      items: sessions,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems: total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    };
  }

  public async getInterviewSessionById(interviewId: string, sessionId: string): Promise<DbSession> {
    // Verify the interview exists and belongs to the user
    await this.getInterviewById(interviewId);

    const session = await this.repository.getInterviewSessionById(interviewId, sessionId);
    if (!session) {
      throw new NotFoundError("Session not found");
    }
    return session;
  }

  public async getSessionQuestions(
    interviewId: string,
    sessionId: string,
  ): Promise<DbSessionQuestion[]> {
    const session = await this.getInterviewSessionById(interviewId, sessionId);

    if (session.status === "ready") {
      throw new AppError({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
        message: "Questions are not disclosed while the session is in ready status",
      });
    }

    const questions = await this.repository.getSessionQuestions(interviewId, sessionId);

    return questions;
  }

  public async getSessionQuestionById(
    interviewId: string,
    sessionId: string,
    sessionQuestionId: string,
  ): Promise<DbSessionQuestion> {
    const session = await this.getInterviewSessionById(interviewId, sessionId);

    if (session.status === "ready") {
      throw new AppError({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
        message: "Questions are not disclosed while the session is in ready status",
      });
    }

    const question = await this.repository.getSessionQuestionById(
      interviewId,
      sessionId,
      sessionQuestionId,
    );
    if (!question) {
      throw new NotFoundError("Session question not found");
    }
    return question;
  }

  public async createSession(
    interviewId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    try {
      const requestHash = generateRequestFingerprint({
        apiVersion: "v1",
        method: "POST",
        routePattern: "/api/v1/interviews/:interviewId/sessions",
        operation: "INTERVIEWS_CREATE_SESSION",
        body: { interviewId },
      });
      return await this.repository.createSession(interviewId, idempotencyKey, requestHash);
    } catch (error: unknown) {
      if (PersistenceError.is(error, PersistenceErrorCode.UNAUTHORIZED_ACCESS)) {
        throw new ForbiddenError(error.message);
      }
      if (PersistenceError.is(error, PersistenceErrorCode.IDEMPOTENCY_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.IDEMPOTENCY_IN_PROGRESS)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)) {
        throw new NotFoundError(error.message);
      }
      if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: ERROR_CODES.RESOURCE_CONFLICT,
          message: error.message,
        });
      }
      if (PersistenceError.is(error, PersistenceErrorCode.INSUFFICIENT_ELIGIBLE_QUESTIONS)) {
        // e.g. insufficient questions
        throw new AppError({
          statusCode: HTTP_STATUS.CONFLICT,
          code: "INSUFFICIENT_ELIGIBLE_QUESTIONS",
          message: error.message,
        });
      }
      throw error;
    }
  }

  private getLifecycleFingerprint(
    operation: string,
    routeSuffix: string,
    interviewId: string,
    sessionId: string,
  ): string {
    return generateRequestFingerprint({
      apiVersion: "v1",
      method: "POST",
      routePattern: `/v1/interviews/:interviewId/sessions/:sessionId/${routeSuffix}`,
      operation,
      body: { interviewId, sessionId },
    });
  }

  private handleLifecycleError(error: unknown): never {
    if (PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)) {
      throw new NotFoundError(error.message);
    }
    if (PersistenceError.is(error, PersistenceErrorCode.UNAUTHORIZED_ACCESS)) {
      throw new ForbiddenError(error.message);
    }
    if (PersistenceError.is(error, PersistenceErrorCode.RECORD_UPDATE_CONFLICT)) {
      throw new AppError({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.RESOURCE_CONFLICT,
        message: error.message,
      });
    }
    if (PersistenceError.is(error, PersistenceErrorCode.IDEMPOTENCY_CONFLICT)) {
      throw new AppError({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.IDEMPOTENCY_CONFLICT,
        message: error.message,
      });
    }
    if (PersistenceError.is(error, PersistenceErrorCode.IDEMPOTENCY_IN_PROGRESS)) {
      throw new AppError({
        statusCode: HTTP_STATUS.CONFLICT,
        code: ERROR_CODES.IDEMPOTENCY_IN_PROGRESS,
        message: error.message,
      });
    }
    throw error;
  }

  public async startSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    try {
      const requestHash = this.getLifecycleFingerprint(
        "SESSION_STARTED",
        "start",
        interviewId,
        sessionId,
      );
      return await this.repository.startSession(
        interviewId,
        sessionId,
        idempotencyKey,
        requestHash,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  public async pauseSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    try {
      const requestHash = this.getLifecycleFingerprint(
        "SESSION_PAUSED",
        "pause",
        interviewId,
        sessionId,
      );
      return await this.repository.pauseSession(
        interviewId,
        sessionId,
        idempotencyKey,
        requestHash,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  public async resumeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    try {
      const requestHash = this.getLifecycleFingerprint(
        "SESSION_RESUMED",
        "resume",
        interviewId,
        sessionId,
      );
      return await this.repository.resumeSession(
        interviewId,
        sessionId,
        idempotencyKey,
        requestHash,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }

  public async completeSession(
    interviewId: string,
    sessionId: string,
    idempotencyKey: string,
  ): Promise<{ replayed: boolean; snapshot: DbSession }> {
    try {
      const requestHash = this.getLifecycleFingerprint(
        "SESSION_COMPLETED",
        "complete",
        interviewId,
        sessionId,
      );
      return await this.repository.completeSession(
        interviewId,
        sessionId,
        idempotencyKey,
        requestHash,
      );
    } catch (error) {
      this.handleLifecycleError(error);
    }
  }
}
