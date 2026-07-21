import { AuthError } from "@supabase/supabase-js";

export type AuthProviderFailureReason =
  | "invalid_credentials"
  | "invalid_refresh_token"
  | "weak_password"
  | "rate_limited"
  | "registration_unavailable"
  | "service_unavailable"
  | "ambiguous_registration"
  | "invalid_request";

export type AuthProviderFailure = {
  success: false;
  reason: AuthProviderFailureReason;
  providerCode?: string;
};

export function normalizeSupabaseAuthError(error: unknown): AuthProviderFailure {
  const isAuthError =
    error instanceof AuthError ||
    (typeof error === "object" && error !== null && ("code" in error || "status" in error));

  if (isAuthError) {
    const authError = error as { code?: string; status?: number };
    const code = authError.code;
    const status = authError.status;

    if (
      status === 429 ||
      code === "over_request_rate_limit" ||
      code === "over_email_send_rate_limit"
    ) {
      return { success: false, reason: "rate_limited", providerCode: code };
    }

    if (status !== undefined && status >= 500) {
      return { success: false, reason: "service_unavailable", providerCode: code };
    }

    switch (code) {
      case "invalid_credentials":
      case "email_not_confirmed":
      case "user_not_found":
      case "user_banned":
        return { success: false, reason: "invalid_credentials", providerCode: code };

      case "user_already_exists":
      case "email_exists":
        return { success: false, reason: "ambiguous_registration", providerCode: code };

      case "weak_password":
        return { success: false, reason: "weak_password", providerCode: code };

      case "signup_disabled":
        return { success: false, reason: "registration_unavailable", providerCode: code };

      case "refresh_token_not_found":
      case "refresh_token_already_used":
      case "session_not_found":
      case "session_expired":
      case "bad_jwt":
        return { success: false, reason: "invalid_refresh_token", providerCode: code };
    }

    if (status === 400 || status === 422) {
      return { success: false, reason: "invalid_request", providerCode: code };
    }
  }

  return { success: false, reason: "service_unavailable" };
}
