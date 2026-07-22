import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import type { CreateRateLimitPolicyOptions } from "./rate-limit-policy.types.js";
import { createRateLimitKeyGenerator } from "./create-rate-limit-key-generator.js";

export function createRateLimitPolicy(options: CreateRateLimitPolicyOptions): RequestHandler {
  if (!options.definition.enabled) {
    return (req, res, next) => {
      next();
    };
  }

  return rateLimit({
    windowMs: options.definition.windowMs,
    limit: options.definition.maxRequests,
    identifier: options.definition.id,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    passOnStoreError: false,
    keyGenerator: createRateLimitKeyGenerator(options.definition.ipv6Subnet),
    skip: (request) => request.method === "OPTIONS",
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    validate: true,
    ...(options.store && { store: options.store }),
    handler: (request, response, next) => {
      next(options.definition.createError());
    },
  });
}
