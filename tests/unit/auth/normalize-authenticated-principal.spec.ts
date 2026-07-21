import { normalizeAuthenticatedPrincipal } from "../../../src/auth/normalize-authenticated-principal.js";
import { InvalidAuthenticationClaimsError } from "../../../src/errors/invalid-authentication-claims.error.js";
import { AccessTokenExpiredError } from "../../../src/errors/access-token-expired.error.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";

describe("Normalize Authenticated Principal", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  const now = () => 1700000000000; // time in ms
  const currentTimeSecs = 1700000000;

  const validClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: currentTimeSecs + 3600,
    iat: currentTimeSecs - 3600,
    sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    role: "authenticated",
    aal: "aal1",
    session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  it("valid claims normalize correctly", () => {
    const principal = normalizeAuthenticatedPrincipal({ claims: validClaims, config, now });
    expect(principal.userId).toBe(validClaims.sub);
    expect(principal.postgresRole).toBe("authenticated");
    expect(principal.accountStatus).toBe("unknown");
    expect(principal.applicationRole).toBeNull();
  });

  it("expected issuer is accepted", () => {
    const principal = normalizeAuthenticatedPrincipal({ claims: validClaims, config, now });
    expect(principal.issuer).toBe(validClaims.iss);
  });

  it("issuer mismatch is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, iss: "https://wrong.com/auth/v1" },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("issuer lookalike is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, iss: "https://example.com.attacker.com/auth/v1" },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("authenticated audience is required", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, aud: "public" },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("audience array is normalized", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, aud: ["authenticated", "other"] },
      config,
      now,
    });
    expect(principal.audiences).toEqual(["authenticated", "other"]);
  });

  it("PostgreSQL role must be authenticated", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, role: "anon" },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("service_role is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, role: "service_role" },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("expired token is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, exp: currentTimeSecs - 60 },
        config,
        now,
      }),
    ).toThrow(AccessTokenExpiredError);
  });

  it("future nbf is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, nbf: currentTimeSecs + 3600 },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("excessively future iat is rejected", () => {
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, iat: currentTimeSecs + 3600 },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("clock skew is applied correctly for exp", () => {
    // expired by 10s, skew allows up to 30s
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, exp: currentTimeSecs - 10 },
        config,
        now,
      }),
    ).not.toThrow();

    // expired by 40s, skew allows 30s
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, exp: currentTimeSecs - 40 },
        config,
        now,
      }),
    ).toThrow(AccessTokenExpiredError);
  });

  it("clock skew is applied correctly for nbf", () => {
    // future by 10s, skew allows up to 30s
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, nbf: currentTimeSecs + 10 },
        config,
        now,
      }),
    ).not.toThrow();

    // future by 40s, skew allows 30s
    expect(() =>
      normalizeAuthenticatedPrincipal({
        claims: { ...validClaims, nbf: currentTimeSecs + 40 },
        config,
        now,
      }),
    ).toThrow(InvalidAuthenticationClaimsError);
  });

  it("application role maps from user_role", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, user_role: "student" },
      config,
      now,
    });
    expect(principal.applicationRole).toBe("student");
  });

  it("missing application role maps to null", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims },
      config,
      now,
    });
    expect(principal.applicationRole).toBeNull();
  });

  it("account status maps from trusted claim", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, account_status: "active" },
      config,
      now,
    });
    expect(principal.accountStatus).toBe("active");
  });

  it("missing account status maps to unknown", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims },
      config,
      now,
    });
    expect(principal.accountStatus).toBe("unknown");
  });

  it("user_metadata.role=admin is ignored", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, user_metadata: { role: "admin" } },
      config,
      now,
    });
    expect(principal.applicationRole).toBeNull();
  });

  it("user_metadata.account_status=active is ignored", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, user_metadata: { account_status: "active" } },
      config,
      now,
    });
    expect(principal.accountStatus).toBe("unknown");
  });

  it("principal contains no metadata objects", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, user_metadata: { role: "admin" }, app_metadata: { foo: "bar" } },
      config,
      now,
    });
    expect((principal as any).user_metadata).toBeUndefined();
    expect((principal as any).app_metadata).toBeUndefined();
  });

  it("principal contains no access token", () => {
    const principal = normalizeAuthenticatedPrincipal({
      claims: { ...validClaims, access_token: "secret" },
      config,
      now,
    });
    expect((principal as any).access_token).toBeUndefined();
  });

  it("principal is frozen", () => {
    const principal = normalizeAuthenticatedPrincipal({ claims: validClaims, config, now });
    expect(Object.isFrozen(principal)).toBe(true);
    expect(Object.isFrozen(principal.audiences)).toBe(true);
  });

  it("configuration remains unchanged", () => {
    const configCopy = JSON.parse(JSON.stringify(config));
    normalizeAuthenticatedPrincipal({ claims: validClaims, config, now });
    expect(config).toEqual(configCopy);
  });
});
