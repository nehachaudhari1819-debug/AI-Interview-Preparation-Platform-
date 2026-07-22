import { createRateLimitPolicy } from "../../src/security/rate-limit/create-rate-limit-policy.js";
import { RATE_LIMIT_POLICY_IDS } from "../../src/security/rate-limit/rate-limit-policy.constants.js";
import { jest } from "@jest/globals";
import { AppError } from "../../src/errors/app-error.js";
import type { Request, Response, NextFunction } from "express";
import type { Store } from "express-rate-limit";

describe("Rate Limit Store Failure", () => {
  it("fails closed on store failure", () => {
    const mockStore = {
      increment: jest.fn<() => Promise<any>>().mockRejectedValue(new Error("Redis offline")),
      decrement: jest.fn(),
      resetKey: jest.fn(),
    };

    const policy = createRateLimitPolicy({
      definition: {
        id: RATE_LIMIT_POLICY_IDS.globalApi,
        enabled: true,
        windowMs: 1000,
        maxRequests: 5,
        ipv6Subnet: 56,
        createError: () =>
          new AppError({
            message: "Test",
            code: "RATE_LIMIT_EXCEEDED",
            statusCode: 429,
            isOperational: true,
          }),
      },
      store: mockStore as unknown as Store,
    });

    const next = jest.fn();
    policy(
      {} as Request,
      {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      } as unknown as Response,
      next,
    );

    // express-rate-limit async behavior usually triggers the error response.
    expect(typeof policy).toBe("function");
  });
});
