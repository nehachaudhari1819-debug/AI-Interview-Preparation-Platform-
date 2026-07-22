import { jest } from "@jest/globals";
import { createRateLimitPolicy } from "../../../../src/security/rate-limit/create-rate-limit-policy.js";
import { RATE_LIMIT_POLICY_IDS } from "../../../../src/security/rate-limit/rate-limit-policy.constants.js";
import { AppError } from "../../../../src/errors/app-error.js";
import type { Request, Response, NextFunction } from "express";
import { MemoryStore } from "express-rate-limit";

describe("createRateLimitPolicy", () => {
  it("should return a passthrough middleware when disabled", () => {
    const policy = createRateLimitPolicy({
      definition: {
        id: RATE_LIMIT_POLICY_IDS.globalApi,
        enabled: false,
        windowMs: 1000,
        maxRequests: 5,
        ipv6Subnet: 56,
        createError: () =>
          new AppError({ message: "Test", code: "TEST", statusCode: 429, isOperational: true }),
      },
    });

    const next = jest.fn() as unknown as NextFunction;
    policy({} as Request, {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // Called without error
  });

  it("should return rate limiter when enabled", () => {
    const store = new MemoryStore();
    const policy = createRateLimitPolicy({
      definition: {
        id: RATE_LIMIT_POLICY_IDS.globalApi,
        enabled: true,
        windowMs: 1000,
        maxRequests: 5,
        ipv6Subnet: 56,
        createError: () =>
          new AppError({ message: "Test", code: "TEST", statusCode: 429, isOperational: true }),
      },
      store,
    });

    expect(typeof policy).toBe("function");
  });
});
