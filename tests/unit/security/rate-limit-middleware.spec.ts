import type { Request, Response, NextFunction } from "express";
import { createApiRateLimitMiddleware } from "../../../src/security/create-rate-limit-middleware.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";

describe("createApiRateLimitMiddleware", () => {
  it("returns a pass-through middleware when rate limit is disabled", () => {
    const config = createTestApplicationConfig({
      security: {
        ...createTestApplicationConfig().security,
        rateLimit: { enabled: false, windowMs: 1000, maxRequests: 10 },
      },
    });
    
    const middleware = createApiRateLimitMiddleware(config);
    const next = jest.fn();
    middleware({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
