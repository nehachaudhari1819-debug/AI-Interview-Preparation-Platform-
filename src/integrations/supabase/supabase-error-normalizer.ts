import {
  SUPABASE_ERROR_CODES,
  SupabaseIntegrationError,
  type SupabaseErrorCode,
} from "../../errors/supabase-integration.error.js";

export type SupabaseOperationKind = "auth" | "database" | "storage" | "unknown";

export function normalizeSupabaseError(
  error: unknown,
  options: {
    operation: string;
    kind?: SupabaseOperationKind;
  },
): SupabaseIntegrationError {
  if (error instanceof SupabaseIntegrationError) {
    return error;
  }

  let code: SupabaseErrorCode = SUPABASE_ERROR_CODES.REQUEST_FAILED;
  let message = "Supabase request failed.";

  if (options.kind === "auth") {
    code = SUPABASE_ERROR_CODES.AUTH_REQUEST_FAILED;
    message = "Supabase authentication request failed.";
  } else if (options.kind === "database") {
    code = SUPABASE_ERROR_CODES.DATABASE_REQUEST_FAILED;
    message = "Supabase database request failed.";
  } else if (options.kind === "storage") {
    code = SUPABASE_ERROR_CODES.STORAGE_REQUEST_FAILED;
    message = "Supabase storage request failed.";
  }

  return new SupabaseIntegrationError({
    code,
    message,
    operation: options.operation,
    cause: error,
  });
}
