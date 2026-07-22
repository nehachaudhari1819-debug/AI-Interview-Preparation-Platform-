import type { Store } from "express-rate-limit";
import type { RateLimitPolicyId } from "./rate-limit-policy.constants.js";
import type { AppError } from "../../errors/app-error.js";

export type RateLimitPolicyDefinition = {
  id: RateLimitPolicyId;
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  ipv6Subnet: number;
  createError: () => AppError;
};

export type CreateRateLimitPolicyOptions = {
  definition: Readonly<RateLimitPolicyDefinition>;
  store?: Store;
};
