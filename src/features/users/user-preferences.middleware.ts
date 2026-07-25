import type { Request, Response, NextFunction } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { extractBearerToken } from "../../auth/bearer-token.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { SupabaseUserPreferencesRepository } from "../../persistence/users/supabase-user-preferences.repository.js";
import { UserPreferencesService } from "./user-preferences.service.js";

export function createUserPreferencesServiceMiddleware(config: Readonly<ApplicationConfig>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenResult = extractBearerToken(req.headers.authorization);

    if (tokenResult.status === "present") {
      const userClient = createUserSupabaseClient({
        config,
        accessToken: tokenResult.token,
      });
      const repository = new SupabaseUserPreferencesRepository(userClient);
      res.locals.userPreferencesService = new UserPreferencesService(repository);
    }

    next();
  };
}
