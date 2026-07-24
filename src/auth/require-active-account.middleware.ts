import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { createUserSupabaseClient } from "../integrations/supabase/create-user-supabase-client.js";
import { SupabaseAccountAccessStateGateway } from "../integrations/supabase/account-authorization/supabase-account-access-state.gateway.js";
import { AccountDisabledError } from "../errors/account-disabled.error.js";
import { AccountDeletedError } from "../errors/account-deleted.error.js";
import { UserProfileNotFoundError } from "../errors/user-profile-not-found.error.js";
import { ServiceUnavailableError } from "../errors/service-unavailable.error.js";
import { extractBearerToken, readSingleAuthorizationHeader } from "./bearer-token.js";
import { asyncHandler } from "../utils/async-handler.js";

export function createRequireActiveAccountMiddleware(
  config: Readonly<ApplicationConfig>,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    // 1. Ensure the user is authenticated from previous middleware
    if (request.context.authentication.state !== "authenticated") {
      throw new Error(
        "createRequireActiveAccountMiddleware must be run after createAuthenticationMiddleware",
      );
    }

    let headerValue: string | undefined;
    try {
      headerValue = readSingleAuthorizationHeader(request);
    } catch {
      // If we got this far without a valid header, something is wrong with our middleware order
      throw new Error(
        "Missing or invalid authorization header in require-active-account middleware",
      );
    }

    if (!headerValue) {
      throw new Error("Missing authorization header in require-active-account middleware");
    }

    const extraction = extractBearerToken(headerValue);
    if (extraction.status !== "present") {
      throw new Error("Invalid bearer token in require-active-account middleware");
    }

    const supabaseClient = createUserSupabaseClient({
      config,
      accessToken: extraction.token,
    });

    const gateway = new SupabaseAccountAccessStateGateway(supabaseClient);

    let state;
    try {
      state = await gateway.getCurrentAccountAccessState();
    } catch (error: unknown) {
      // Wrap known/unknown dependency failures
      if (error instanceof Error && error.message.includes("Account state resolution failed")) {
        throw new ServiceUnavailableError();
      }
      throw error;
    }

    // 4. Map the state to errors or allow
    switch (state) {
      case "active":
        next();
        return;
      case "disabled":
        throw new AccountDisabledError();
      case "deleted":
        throw new AccountDeletedError();
      case "missing":
        throw new UserProfileNotFoundError();
      default:
        // Fail closed for unknown state
        throw new UserProfileNotFoundError();
    }
  });
}
