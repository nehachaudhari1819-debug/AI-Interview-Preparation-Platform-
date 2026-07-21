export const APPLICATION_ROLES = ["student", "admin"] as const;

export const ACCOUNT_STATUSES = ["active", "suspended", "disabled", "unknown"] as const;

export const AUTHENTICATOR_ASSURANCE_LEVELS = ["aal1", "aal2"] as const;

export const SUPABASE_AUTHENTICATED_AUDIENCE = "authenticated";

export const SUPABASE_AUTHENTICATED_ROLE = "authenticated";

export const MAX_BEARER_TOKEN_LENGTH = 16 * 1024;

export const AUTH_CLOCK_SKEW_SECONDS = 30;
