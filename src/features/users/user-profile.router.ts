import { Router } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";
import { createGetMeController } from "./user-profile.controller.js";
import type { UserProfileService } from "./user-profile.service.js";

export function createUserProfileRouter(options: {
  config: Readonly<ApplicationConfig>;
  serviceFactory: (token: string) => UserProfileService;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
}): Router {
  const router = Router();

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });

  router.get(
    "/me",
    authMiddleware,
    authNoStoreMiddleware,
    createGetMeController(options.serviceFactory),
  );

  return router;
}
