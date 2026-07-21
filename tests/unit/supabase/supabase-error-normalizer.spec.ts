import { normalizeSupabaseError } from "../../../src/integrations/supabase/supabase-error-normalizer.js";
import {
  SUPABASE_ERROR_CODES,
  SupabaseIntegrationError,
} from "../../../src/errors/supabase-integration.error.js";

describe("normalizeSupabaseError", () => {
  it("preserves an existing SupabaseIntegrationError", () => {
    const existing = new SupabaseIntegrationError({
      code: SUPABASE_ERROR_CODES.INVALID_ACCESS_TOKEN_INPUT,
      message: "Test message",
    });

    const result = normalizeSupabaseError(existing, { operation: "test" });
    expect(result).toBe(existing);
  });

  it("maps auth kind to safe auth code", () => {
    const result = normalizeSupabaseError(
      new Error("Raw auth provider error with secret sk_test_123"),
      {
        operation: "login",
        kind: "auth",
      },
    );

    expect(result.code).toBe(SUPABASE_ERROR_CODES.AUTH_REQUEST_FAILED);
    expect(result.message).toBe("Supabase authentication request failed.");
    expect(result.message).not.toContain("sk_test_123");
    expect(result.operation).toBe("login");
    expect(result.cause).toBeInstanceOf(Error);
  });

  it("maps database kind to safe database code", () => {
    const result = normalizeSupabaseError(new Error("Raw db error"), {
      kind: "database",
      operation: "query",
    });
    expect(result.code).toBe(SUPABASE_ERROR_CODES.DATABASE_REQUEST_FAILED);
    expect(result.message).toBe("Supabase database request failed.");
  });

  it("maps storage kind to safe storage code", () => {
    const result = normalizeSupabaseError(new Error("Raw storage error"), {
      kind: "storage",
      operation: "upload",
    });
    expect(result.code).toBe(SUPABASE_ERROR_CODES.STORAGE_REQUEST_FAILED);
    expect(result.message).toBe("Supabase storage request failed.");
  });

  it("maps unknown kind to generic code", () => {
    const result = normalizeSupabaseError(new Error("Unknown error"), { operation: "test" });
    expect(result.code).toBe(SUPABASE_ERROR_CODES.REQUEST_FAILED);
    expect(result.message).toBe("Supabase request failed.");
  });
});
