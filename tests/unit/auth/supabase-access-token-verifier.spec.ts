import { jest } from "@jest/globals";
import { createSupabaseAccessTokenVerifier } from "../../../src/auth/supabase-access-token-verifier.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";
import * as PublicClientModule from "../../../src/integrations/supabase/create-public-supabase-client.js";

describe("Supabase Access Token Verifier", () => {
  const config = createTestApplicationConfig();

  it("uses public Supabase client", () => {
    const spy = jest.fn<any>().mockImplementation(
      () =>
        ({
          auth: {
            getClaims: jest.fn(),
          },
        }) as any,
    );

    createSupabaseAccessTokenVerifier({ config, dependencies: { createPublicClient: spy } });

    expect(spy).toHaveBeenCalledWith({ config });
  });

  it("returns verified claims", async () => {
    const claims = { sub: "123" };
    const getClaims = jest.fn<any>().mockResolvedValue({ data: { claims }, error: null });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.claims).toEqual(claims);
    }
  });

  it("invalid provider response maps to invalid", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { code: "bad_jwt", name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "invalid",
      providerCode: "bad_jwt",
    });
  });

  it("stable expiry code maps to expired", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { code: "session_expired", name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "expired",
      providerCode: "session_expired",
    });
  });

  it("provider 429 maps to service unavailable", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { status: 429, name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "service_unavailable",
      providerCode: "service_unavailable",
    });
  });

  it("provider 500 maps to service unavailable", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { status: 500, name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "service_unavailable",
      providerCode: "service_unavailable",
    });
  });

  it("request timeout maps to service unavailable", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { code: "request_timeout", name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "service_unavailable",
      providerCode: "request_timeout",
    });
  });

  it("thrown network error maps to service unavailable", async () => {
    const getClaims = jest.fn<any>().mockRejectedValue(new Error("Network Error"));

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect(result).toEqual({
      success: false,
      reason: "service_unavailable",
      providerCode: "unexpected_exception",
    });
  });

  it("raw provider message is excluded", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({
      data: null,
      error: { code: "invalid_claim", message: "super secret message", name: "AuthError" },
    });

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token");

    expect((result as any).message).toBeUndefined();
    expect((result as any).error).toBeUndefined();
  });

  it("token is excluded from errors", async () => {
    const getClaims = jest.fn<any>().mockRejectedValue(new Error("Network Error"));

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    const result = await verifier.verify("token-secret123");

    expect(JSON.stringify(result)).not.toContain("token-secret123");
  });

  it("configuration is not mutated", async () => {
    const getClaims = jest.fn<any>().mockResolvedValue({ data: { claims: {} }, error: null });
    const configCopy = JSON.parse(JSON.stringify(config));

    const verifier = createSupabaseAccessTokenVerifier({ config, dependencies: { getClaims } });
    await verifier.verify("token");

    expect(config).toEqual(configCopy);
  });
});
