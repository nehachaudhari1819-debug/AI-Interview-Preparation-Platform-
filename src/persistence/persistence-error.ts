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
}

export class PersistenceError extends Error {
  public readonly code: PersistenceErrorCode;
  public readonly originalError?: unknown;

  constructor(code: PersistenceErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = "PersistenceError";
    this.code = code;
    this.originalError = originalError;

    // Maintain proper stack trace in V8 engines
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PersistenceError);
    }
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
