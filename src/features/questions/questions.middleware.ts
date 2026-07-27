import type { Request, Response, NextFunction } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { extractBearerToken } from "../../auth/bearer-token.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { SupabaseQuestionsRepository } from "../../persistence/questions/supabase-questions.repository.js";
import { createQuestionsService } from "./questions.service.js";

export function createQuestionsServiceMiddleware(config: Readonly<ApplicationConfig>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenResult = extractBearerToken(req.headers.authorization);

    if (tokenResult.status === "present") {
      const userClient = createUserSupabaseClient({
        config,
        accessToken: tokenResult.token,
      });
      const repository = new SupabaseQuestionsRepository(userClient);

      res.locals.questionsService = createQuestionsService(repository);
    }

    next();
  };
}
