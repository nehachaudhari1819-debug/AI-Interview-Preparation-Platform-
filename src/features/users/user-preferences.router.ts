import { Router } from "express";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";
import { createAuthSessionRateLimiter } from "../../security/index.js";
import {
  createGetPreferencesController,
  createUpdatePreferencesController,
} from "./user-preferences.controller.js";
import { createUserPreferencesServiceMiddleware } from "./user-preferences.middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";

export function createUserPreferencesRouter(options: {
  config: Readonly<ApplicationConfig>;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
  activeAccountMiddleware?: RequestHandler;
  serviceMiddleware?: RequestHandler;
}): Router {
  const router = Router();

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });

  const activeAccountMiddleware =
    options.activeAccountMiddleware ?? createRequireActiveAccountMiddleware(options.config);

  const serviceMiddleware =
    options.serviceMiddleware ?? createUserPreferencesServiceMiddleware(options.config);

  const rateLimiter = createAuthSessionRateLimiter(options.config);

  router.get(
    "/",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    rateLimiter,
    serviceMiddleware,
    createGetPreferencesController(),
  );

  router.patch(
    "/",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    rateLimiter,
    serviceMiddleware,
    createUpdatePreferencesController(),
  );

  return router;
}
