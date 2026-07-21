export const SUPABASE_ERROR_CODES = {
  CONFIGURATION_REQUIRED: "SUPABASE_CONFIGURATION_REQUIRED",
  REQUEST_FAILED: "SUPABASE_REQUEST_FAILED",
  AUTH_REQUEST_FAILED: "SUPABASE_AUTH_REQUEST_FAILED",
  DATABASE_REQUEST_FAILED: "SUPABASE_DATABASE_REQUEST_FAILED",
  STORAGE_REQUEST_FAILED: "SUPABASE_STORAGE_REQUEST_FAILED",
  INVALID_ACCESS_TOKEN_INPUT: "INVALID_ACCESS_TOKEN_INPUT",
} as const;

export type SupabaseErrorCode = (typeof SUPABASE_ERROR_CODES)[keyof typeof SUPABASE_ERROR_CODES];

export class SupabaseIntegrationError extends Error {
  public readonly code: SupabaseErrorCode;
  public readonly operation?: string;

  public constructor(options: {
    code: SupabaseErrorCode;
    message: string;
    operation?: string;
    cause?: unknown;
  }) {
    super(options.message, {
      cause: options.cause,
    });

    this.name = "SupabaseIntegrationError";
    this.code = options.code;

    if (options.operation !== undefined) {
      this.operation = options.operation;
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
