import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createRateLimitPolicy } from "./create-rate-limit-policy.js";
import { RATE_LIMIT_POLICY_IDS } from "./rate-limit-policy.constants.js";
import { RateLimitExceededError } from "../../errors/rate-limit-exceeded.error.js";
import { MemoryStore } from "express-rate-limit";

export function createGlobalApiRateLimiter(config: Readonly<ApplicationConfig>): RequestHandler {
  const store = new MemoryStore();

  return createRateLimitPolicy({
    definition: {
      id: RATE_LIMIT_POLICY_IDS.globalApi,
      enabled: config.rateLimits.globalApi.enabled,
      windowMs: config.rateLimits.globalApi.windowMs,
      maxRequests: config.rateLimits.globalApi.maxRequests,
      ipv6Subnet: config.rateLimits.ipv6Subnet,
      createError: () => new RateLimitExceededError(),
    },
    store,
  });
}
