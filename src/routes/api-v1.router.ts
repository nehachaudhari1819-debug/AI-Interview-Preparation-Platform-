import { Router } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { createAuthRouter } from "../features/auth/auth.router.js";
import { createUserSupabaseClient } from "../integrations/supabase/create-user-supabase-client.js";
import { SupabaseUserProfileRepository } from "../persistence/users/supabase-user-profile.repository.js";
import { createUserProfileService, createUserProfileRouter } from "../features/users/index.js";

export function createApiV1Router(config: Readonly<ApplicationConfig>): Router {
  const router = Router();

  const authRouter = createAuthRouter({ config });
  router.use("/auth", authRouter);

  const serviceFactory = (accessToken: string) => {
    const supabaseClient = createUserSupabaseClient({ config, accessToken });
    const userProfileRepository = new SupabaseUserProfileRepository(supabaseClient);
    return createUserProfileService(userProfileRepository);
  };
  const usersRouter = createUserProfileRouter({ config, serviceFactory });
  router.use("/users", usersRouter);

  return router;
}
