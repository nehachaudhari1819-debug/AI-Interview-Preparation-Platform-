import { createAuthSessionRateLimiter } from "../../../../src/security/rate-limit/create-auth-session-rate-limiter.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";

describe("createAuthSessionRateLimiter", () => {
  it("should return a middleware function", () => {
    const config = createTestApplicationConfig();
    const limiter = createAuthSessionRateLimiter(config);
    expect(typeof limiter).toBe("function");
  });
});
