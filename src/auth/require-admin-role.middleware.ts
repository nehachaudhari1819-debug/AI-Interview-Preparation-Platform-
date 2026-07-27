import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { ForbiddenError } from "../errors/forbidden.error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createUserSupabaseClient } from "../integrations/supabase/create-user-supabase-client.js";
import { SupabaseUserProfileRepository } from "../persistence/users/supabase-user-profile.repository.js";
import { extractBearerToken, readSingleAuthorizationHeader } from "./bearer-token.js";

/**
 * Middleware that strictly enforces the user is an admin via a database check.
 * MUST be registered AFTER the general authentication middleware.
 * Prevents stale-token privilege escalation by checking the real-time DB role.
 */
export function createRequireAdminRoleMiddleware(
  config: Readonly<ApplicationConfig>,
): RequestHandler {
  return asyncHandler(async (request, _response, next) => {
    // 1. Ensure the user is authenticated from previous middleware
    if (request.context.authentication.state !== "authenticated") {
      throw new Error(
        "createRequireAdminRoleMiddleware must be run after createAuthenticationMiddleware",
      );
    }

    // 2. We extract the raw token to instantiate a user-bound Supabase client
    let headerValue: string | undefined;
    try {
      headerValue = readSingleAuthorizationHeader(request);
    } catch {
      throw new ForbiddenError("Missing or malformed authorization header.");
    }
    const tokenResult = extractBearerToken(headerValue);
    if (tokenResult.status !== "present") {
      throw new ForbiddenError("Missing or malformed bearer token.");
    }
    const token = tokenResult.token;

    // 3. Instantiate DB repository with the user's token
    let supabaseClient;
    try {
      supabaseClient = createUserSupabaseClient({ config, accessToken: token });
    } catch {
      throw new ForbiddenError("Failed to initialize database client.");
    }

    const repository = new SupabaseUserProfileRepository(supabaseClient);

    // 4. Fetch the fresh profile from DB
    let profile;
    try {
      profile = await repository.findById(request.context.authentication.principal.userId);
    } catch {
      throw new ForbiddenError("Failed to retrieve user profile for admin verification.");
    }

    // 5. Verify database-backed role
    if (profile.role !== "admin") {
      throw new ForbiddenError("This operation requires administrator privileges.");
    }

    // 6. Verify account is not soft-deleted or disabled
    if (profile.accountStatus !== "active") {
      throw new ForbiddenError("Admin account is not active.");
    }

    next();
  });
}
