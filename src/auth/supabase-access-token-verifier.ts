import type { ApplicationConfig } from "../config/app-config.js";
import { createPublicSupabaseClient } from "../integrations/supabase/create-public-supabase-client.js";

export type AccessTokenVerificationFailureReason = "invalid" | "expired" | "service_unavailable";

export type AccessTokenVerificationResult =
  | {
      success: true;
      claims: unknown;
    }
  | {
      success: false;
      reason: AccessTokenVerificationFailureReason;
      providerCode?: string;
    };

export type AccessTokenVerifier = {
  verify(accessToken: string): Promise<AccessTokenVerificationResult>;
};

export type CreateSupabaseAccessTokenVerifierOptions = {
  config: Readonly<ApplicationConfig>;
  dependencies?: {
    createPublicClient?: typeof createPublicSupabaseClient;
    getClaims?:
      | ((accessToken: string) => Promise<{
          data: {
            claims?: unknown;
          } | null;
          error: unknown;
        }>)
      | undefined;
  };
};

export function createSupabaseAccessTokenVerifier(
  options: CreateSupabaseAccessTokenVerifierOptions,
): AccessTokenVerifier {
  let getClaims = options.dependencies?.getClaims;

  if (!getClaims) {
    const publicClientFactory =
      options.dependencies?.createPublicClient ?? createPublicSupabaseClient;
    const publicClient = publicClientFactory({ config: options.config });
    getClaims = async (token: string) => {
      const response = await publicClient.auth.getClaims(token);
      return {
        data: response.data ? { claims: response.data.claims } : null,
        error: response.error,
      };
    };
  }

  return {
    verify: async (accessToken: string): Promise<AccessTokenVerificationResult> => {
      try {
        const response = await getClaims(accessToken);

        if (response.error) {
          // Identify Supabase Auth errors defensively
          const authError = response.error as { name?: string; status?: number; code?: string };

          // Network or server errors
          if (
            authError.status === 429 ||
            (authError.status && authError.status >= 500) ||
            authError.name === "FetchError" ||
            authError.code === "request_timeout" ||
            authError.code === "unexpected_failure"
          ) {
            return {
              success: false,
              reason: "service_unavailable",
              providerCode: authError.code ?? "service_unavailable",
            };
          }

          if (authError.code === "session_expired") {
            return {
              success: false,
              reason: "expired",
              providerCode: "session_expired",
            };
          }

          // Default all other errors to invalid
          return {
            success: false,
            reason: "invalid",
            providerCode: authError.code ?? "invalid",
          };
        }

        if (!response.data || !response.data.claims) {
          return {
            success: false,
            reason: "invalid",
            providerCode: "missing_claims",
          };
        }

        return {
          success: true,
          claims: response.data.claims,
        };
      } catch {
        // Uncaught exceptions (like network failures throwing)
        return {
          success: false,
          reason: "service_unavailable",
          providerCode: "unexpected_exception",
        };
      }
    },
  };
}
