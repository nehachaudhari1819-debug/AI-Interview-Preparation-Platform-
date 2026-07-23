import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { AccountDeletionService } from "./account-deletion.service.js";
import { createSupabaseAccountLifecycleRepository } from "../../persistence/users/supabase-account-lifecycle.repository.js";
import { createSupabaseAccountSessionRevocationGateway } from "../../integrations/supabase/account-lifecycle/supabase-account-session-revocation.gateway.js";

export function createAccountDeletionServiceMiddleware(
  config: Readonly<ApplicationConfig>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.accountDeletionService) {
      res.locals.accountDeletionService = new AccountDeletionService({
        lifecycleRepo: createSupabaseAccountLifecycleRepository(config),
        sessionGateway: createSupabaseAccountSessionRevocationGateway(config),
      });
    }
    next();
  };
}
