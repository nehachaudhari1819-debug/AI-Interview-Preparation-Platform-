import { Router } from "express";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";
import { createGetMeController } from "./user-profile.controller.js";
import type { UserProfileService } from "./user-profile.service.js";

import { createUserProfileServiceMiddleware } from "./user-profile.middleware.js";

export function createUserProfileRouter(options: {
  config: Readonly<ApplicationConfig>;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
  serviceMiddleware?: RequestHandler;
}): Router {
  const router = Router();

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });

  const serviceMiddleware =
    options.serviceMiddleware ?? createUserProfileServiceMiddleware(options.config);

  router.get(
    "/me",
    authNoStoreMiddleware,
    authMiddleware,
    serviceMiddleware,
    createGetMeController(),
  );

  return router;
}
