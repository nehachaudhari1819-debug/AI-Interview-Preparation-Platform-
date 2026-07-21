import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { RateLimitExceededError } from "../errors/rate-limit-exceeded.error.js";

export function createApiRateLimitMiddleware(config: Readonly<ApplicationConfig>): RequestHandler {
  if (!config.security.rateLimit.enabled) {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: config.security.rateLimit.windowMs,
    limit: config.security.rateLimit.maxRequests,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "OPTIONS",
    handler: (req, res, next) => {
      next(new RateLimitExceededError());
    },
  });
}
