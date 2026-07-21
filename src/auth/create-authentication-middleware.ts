import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import type { AccessTokenVerifier } from "./supabase-access-token-verifier.js";
import { createSupabaseAccessTokenVerifier } from "./supabase-access-token-verifier.js";
import { extractBearerToken, readSingleAuthorizationHeader } from "./bearer-token.js";
import { normalizeAuthenticatedPrincipal } from "./normalize-authenticated-principal.js";
import { AuthenticationRequiredError } from "../errors/authentication-required.error.js";
import { InvalidAuthorizationHeaderError } from "../errors/invalid-authorization-header.error.js";
import { InvalidAccessTokenError } from "../errors/invalid-access-token.error.js";
import { AccessTokenExpiredError } from "../errors/access-token-expired.error.js";
import { AuthenticationServiceUnavailableError } from "../errors/authentication-service-unavailable.error.js";
import { InvalidAuthenticationClaimsError } from "../errors/invalid-authentication-claims.error.js";
import { asyncHandler } from "../utils/async-handler.js";

export type CreateAuthenticationMiddlewareOptions = {
  config: Readonly<ApplicationConfig>;
  verifier?: AccessTokenVerifier;
  now?: () => number;
};

export function createAuthenticationMiddleware(
  options: CreateAuthenticationMiddlewareOptions,
): RequestHandler {
  const verifier =
    options.verifier ?? createSupabaseAccessTokenVerifier({ config: options.config });

  return asyncHandler(async (request, _response, next) => {
    let headerValue: string | undefined;

    try {
      headerValue = readSingleAuthorizationHeader(request);
    } catch (error) {
      if (error instanceof InvalidAuthorizationHeaderError) {
        throw error;
      }
      throw new InvalidAuthorizationHeaderError();
    }

    if (!headerValue) {
      throw new AuthenticationRequiredError();
    }

    const extraction = extractBearerToken(headerValue);
    if (extraction.status === "missing") {
      throw new InvalidAuthorizationHeaderError();
    }

    // extraction.token represents the Bearer token
    // The raw access token must never be logged or stored in the context.
    const result = await verifier.verify(extraction.token);

    if (!result.success) {
      switch (result.reason) {
        case "expired":
          throw new AccessTokenExpiredError();
        case "service_unavailable":
          throw new AuthenticationServiceUnavailableError();
        case "invalid":
        default:
          throw new InvalidAccessTokenError();
      }
    }

    let principal;
    try {
      principal = normalizeAuthenticatedPrincipal({
        claims: result.claims,
        config: options.config,
        now: options.now,
      });
    } catch (error) {
      if (
        error instanceof InvalidAuthenticationClaimsError ||
        error instanceof AccessTokenExpiredError
      ) {
        throw error;
      }
      throw new InvalidAuthenticationClaimsError();
    }

    request.context = {
      ...request.context,
      authentication: {
        state: "authenticated",
        principal,
      },
    };

    next();
  });
}
