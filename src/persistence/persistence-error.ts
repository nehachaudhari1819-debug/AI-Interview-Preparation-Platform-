/**
 * Standardized error codes mapping for database and persistence failures.
 * Prevents raw PostgreSQL/Supabase errors from leaking out of the persistence layer.
 */
export enum PersistenceErrorCode {
  RECORD_NOT_FOUND = "RECORD_NOT_FOUND",
  RECORD_ALREADY_EXISTS = "RECORD_ALREADY_EXISTS",
  RECORD_UPDATE_CONFLICT = "RECORD_UPDATE_CONFLICT",
  PERSISTENCE_UNAVAILABLE = "PERSISTENCE_UNAVAILABLE",
  OPERATION_FAILED = "OPERATION_FAILED",
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  IDEMPOTENCY_IN_PROGRESS = "IDEMPOTENCY_IN_PROGRESS",
  INSUFFICIENT_ELIGIBLE_QUESTIONS = "INSUFFICIENT_ELIGIBLE_QUESTIONS",

  // P6.3 — Answer lifecycle
  SESSION_TERMINAL = "SESSION_TERMINAL",
  STALE_UPDATE_CONFLICT = "STALE_UPDATE_CONFLICT",
  ANSWER_IMMUTABLE = "ANSWER_IMMUTABLE",
  ANSWER_SKIPPED = "ANSWER_SKIPPED",
}

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PersistenceError";
    this.code = code;

    Error.captureStackTrace(this, PersistenceError);
  }

  /**
   * Helper to determine if an error is a specific persistence error
   */
  static is(err: unknown, code?: PersistenceErrorCode): err is PersistenceError {
    if (err instanceof PersistenceError) {
      if (code !== undefined) {
        return err.code === code;
      }
      return true;
    }
    return false;
  }
}
