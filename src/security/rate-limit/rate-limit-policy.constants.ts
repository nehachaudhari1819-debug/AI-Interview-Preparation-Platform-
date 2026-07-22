export const RATE_LIMIT_POLICY_IDS = {
  globalApi: "global-api",
  authCredentials: "auth-credentials",
  authSession: "auth-session",
} as const;

export type RateLimitPolicyId = (typeof RATE_LIMIT_POLICY_IDS)[keyof typeof RATE_LIMIT_POLICY_IDS];
