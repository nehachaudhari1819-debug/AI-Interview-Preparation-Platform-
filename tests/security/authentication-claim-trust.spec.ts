import { normalizeAuthenticatedPrincipal } from "../../src/auth/normalize-authenticated-principal.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("Authentication Claim Trust Security", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };
  const now = () => 1700000000000;
  const currentTimeSecs = 1700000000;

  const baseClaims = {
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

  it("untrusted user metadata cannot escalate application role", () => {
    // A malicious user might try to update their raw user_metadata in Supabase
    // to include "role": "admin". The JWT verified claims schema captures this in
    // user_metadata, but our normalizer must ignore it and only use user_role.
    const maliciousClaims = {
      ...baseClaims,
      user_metadata: { role: "admin", user_role: "admin" },
      app_metadata: { role: "admin", user_role: "admin" },
    };

    const principal = normalizeAuthenticatedPrincipal({ claims: maliciousClaims, config, now });

    // Application role should be null since the top-level user_role claim is missing
    expect(principal.applicationRole).toBeNull();
  });

  it("untrusted user metadata cannot alter account status", () => {
    const maliciousClaims = {
      ...baseClaims,
      user_metadata: { account_status: "active" },
    };

    const principal = normalizeAuthenticatedPrincipal({ claims: maliciousClaims, config, now });

    // Account status defaults to unknown if missing from top-level trusted claims
    expect(principal.accountStatus).toBe("unknown");
  });
});
