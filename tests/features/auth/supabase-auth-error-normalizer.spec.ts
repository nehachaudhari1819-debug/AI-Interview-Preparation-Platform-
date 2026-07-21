import { normalizeSupabaseAuthError } from "../../../src/features/auth/supabase-auth-error-normalizer.js";
import { AuthError } from "@supabase/supabase-js";

describe("normalizeSupabaseAuthError", () => {
  it("returns invalid_credentials for AuthError with invalid_credentials code", () => {
    const error = new AuthError("Message", 400, "invalid_credentials");
    expect(normalizeSupabaseAuthError(error)).toEqual({
      success: false,
      reason: "invalid_credentials",
      providerCode: "invalid_credentials",
    });
  });

  it("returns invalid_refresh_token for AuthError with refresh_token_not_found code", () => {
    const error = new AuthError("Message", 400, "refresh_token_not_found");
    expect(normalizeSupabaseAuthError(error)).toEqual({
      success: false,
      reason: "invalid_refresh_token",
      providerCode: "refresh_token_not_found",
    });
  });

  it("returns rate_limited for status 429", () => {
    const error = new AuthError("Message", 429, "custom_code");
    expect(normalizeSupabaseAuthError(error)).toEqual({
      success: false,
      reason: "rate_limited",
      providerCode: "custom_code",
    });
  });

  it("returns service_unavailable for status 500+", () => {
    const error = new AuthError("Message", 500, "custom_code");
    expect(normalizeSupabaseAuthError(error)).toEqual({
      success: false,
      reason: "service_unavailable",
      providerCode: "custom_code",
    });
  });

  it("returns service_unavailable for non-AuthErrors", () => {
    const error = new Error("Generic error");
    expect(normalizeSupabaseAuthError(error)).toEqual({
      success: false,
      reason: "service_unavailable",
    });
  });
});
