import { createAuthCredentialRateLimiter } from "../../../../src/security/rate-limit/create-auth-credential-rate-limiter.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";

describe("createAuthCredentialRateLimiter", () => {
  it("should return a middleware function", () => {
    const config = createTestApplicationConfig();
    const limiter = createAuthCredentialRateLimiter(config);
    expect(typeof limiter).toBe("function");
  });
});
