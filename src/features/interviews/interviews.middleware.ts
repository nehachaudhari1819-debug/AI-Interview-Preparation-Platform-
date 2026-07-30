import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { SupabaseInterviewsRepository } from "../../persistence/interviews/supabase-interviews.repository.js";
import { InterviewsService } from "./interviews.service.js";

import { extractBearerToken } from "../../auth/bearer-token.js";

export function createInterviewsServiceMiddleware(
  config: Readonly<ApplicationConfig>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const tokenResult = extractBearerToken(req.headers.authorization);
      const token = tokenResult.status === "present" ? tokenResult.token : "";

      // Create an authenticated Supabase client scoped to this request
      const supabase = createUserSupabaseClient({
        config,
        accessToken: token,
      });

      const repository = new SupabaseInterviewsRepository(supabase);
      const service = new InterviewsService(repository);

      // Inject the service into res.locals
      res.locals.interviewsService = service;

      next();
    } catch (error) {
      next(error);
    }
  };
}
