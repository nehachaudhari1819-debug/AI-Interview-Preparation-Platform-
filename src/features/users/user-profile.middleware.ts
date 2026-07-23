import type { Request, Response, NextFunction } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { extractBearerToken } from "../../auth/bearer-token.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { SupabaseUserProfileRepository } from "../../persistence/users/supabase-user-profile.repository.js";
import { createUserProfileService } from "./user-profile.service.js";

export function createUserProfileServiceMiddleware(config: Readonly<ApplicationConfig>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenResult = extractBearerToken(req.headers.authorization);

    if (tokenResult.status === "present") {
      const userClient = createUserSupabaseClient({
        config,
        accessToken: tokenResult.token,
      });
      const userRepository = new SupabaseUserProfileRepository(userClient);

      res.locals.userProfileService = createUserProfileService(userRepository);
    }

    next();
  };
}
