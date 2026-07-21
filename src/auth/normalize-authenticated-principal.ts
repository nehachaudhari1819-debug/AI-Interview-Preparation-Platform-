import type { ApplicationConfig } from "../config/app-config.js";
import {
  AUTH_CLOCK_SKEW_SECONDS,
  SUPABASE_AUTHENTICATED_AUDIENCE,
  SUPABASE_AUTHENTICATED_ROLE,
} from "./auth.constants.js";
import type { AuthenticatedPrincipal } from "./authentication.types.js";
import { verifiedAccessTokenClaimsSchema } from "./access-token-claims.schema.js";
import { InvalidAuthenticationClaimsError } from "../errors/invalid-authentication-claims.error.js";
import { AccessTokenExpiredError } from "../errors/access-token-expired.error.js";
import { deepFreeze } from "../utils/deep-freeze.js";

export type NormalizeAuthenticatedPrincipalOptions = {
  claims: unknown;
  config: Readonly<ApplicationConfig>;
  now?: (() => number) | undefined;
};

export function normalizeAuthenticatedPrincipal(
  options: NormalizeAuthenticatedPrincipalOptions,
): Readonly<AuthenticatedPrincipal> {
  const { claims, config, now = () => Date.now() } = options;

  const parsed = verifiedAccessTokenClaimsSchema.safeParse(claims);
  if (!parsed.success) {
    throw new InvalidAuthenticationClaimsError();
  }

  const verified = parsed.data;

  // Validate exact issuer
  const supabaseUrl = config.supabase.configured ? config.supabase.url : "";
  const expectedIssuer = `${supabaseUrl}/auth/v1`;
  if (verified.iss !== expectedIssuer) {
    throw new InvalidAuthenticationClaimsError();
  }

  // Normalize audience
  const audArray = Array.isArray(verified.aud) ? verified.aud : [verified.aud];
  if (!audArray.includes(SUPABASE_AUTHENTICATED_AUDIENCE)) {
    throw new InvalidAuthenticationClaimsError();
  }

  // Require authenticated PostgreSQL role
  if (verified.role !== SUPABASE_AUTHENTICATED_ROLE) {
    throw new InvalidAuthenticationClaimsError();
  }

  // Validate times
  const currentTimeSecs = Math.floor(now() / 1000);

  // Validate exp
  if (verified.exp <= currentTimeSecs - AUTH_CLOCK_SKEW_SECONDS) {
    throw new AccessTokenExpiredError();
  }

  // Validate nbf (if present)
  if (verified.nbf !== undefined && verified.nbf > currentTimeSecs + AUTH_CLOCK_SKEW_SECONDS) {
    throw new InvalidAuthenticationClaimsError();
  }

  // Validate iat
  if (verified.iat > currentTimeSecs + AUTH_CLOCK_SKEW_SECONDS) {
    throw new InvalidAuthenticationClaimsError();
  }

  const principal: AuthenticatedPrincipal = {
    userId: verified.sub,
    sessionId: verified.session_id,
    issuer: verified.iss,
    audiences: audArray,
    postgresRole: "authenticated",
    assuranceLevel: verified.aal,
    issuedAt: verified.iat,
    expiresAt: verified.exp,
    isAnonymous: verified.is_anonymous,
    email: verified.email,
    phone: verified.phone,
    applicationRole: verified.user_role ?? null,
    accountStatus: verified.account_status ?? "unknown",
  };

  return deepFreeze(principal);
}
