import { createAuthApiRateLimitMiddleware } from "../../../src/features/auth/create-auth-api-rate-limit.middleware.js";
import { AuthenticationRateLimitExceededError } from "../../../src/errors/authentication-rate-limit-exceeded.error.js";
import type { Request, Response } from "express";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

describe("createAuthApiRateLimitMiddleware", () => {
  it("returns a pass-through middleware when disabled", () => {
    const config = {
      security: { rateLimit: { enabled: false } },
    } as unknown as Readonly<ApplicationConfig>;

    const middleware = createAuthApiRateLimitMiddleware(config);
    const next = jest.fn();

    middleware({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
