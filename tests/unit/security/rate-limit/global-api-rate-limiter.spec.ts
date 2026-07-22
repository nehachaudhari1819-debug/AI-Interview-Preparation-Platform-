import { createGlobalApiRateLimiter } from "../../../../src/security/rate-limit/create-global-api-rate-limiter.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";

describe("createGlobalApiRateLimiter", () => {
  it("should return a middleware function", () => {
    const config = createTestApplicationConfig();
    const limiter = createGlobalApiRateLimiter(config);
    expect(typeof limiter).toBe("function");
  });
});
