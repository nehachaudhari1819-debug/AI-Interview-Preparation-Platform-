import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createRateLimitPolicy } from "./create-rate-limit-policy.js";
import { RATE_LIMIT_POLICY_IDS } from "./rate-limit-policy.constants.js";
import { AuthenticationRateLimitExceededError } from "../../errors/authentication-rate-limit-exceeded.error.js";
import { MemoryStore } from "express-rate-limit";

export function createAuthSessionRateLimiter(config: Readonly<ApplicationConfig>): RequestHandler {
  const store = new MemoryStore();

  return createRateLimitPolicy({
    definition: {
      id: RATE_LIMIT_POLICY_IDS.authSession,
      enabled: config.rateLimits.authSession.enabled,
      windowMs: config.rateLimits.authSession.windowMs,
      maxRequests: config.rateLimits.authSession.maxRequests,
      ipv6Subnet: config.rateLimits.ipv6Subnet,
      createError: () => new AuthenticationRateLimitExceededError(),
    },
    store,
  });
}
