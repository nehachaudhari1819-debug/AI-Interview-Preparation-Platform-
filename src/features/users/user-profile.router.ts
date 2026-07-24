import { Router } from "express";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";
import { createGetMeController, createUpdateMeController } from "./user-profile.controller.js";
import { createUserProfileServiceMiddleware } from "./user-profile.middleware.js";
import { createDeleteMeController } from "./account-deletion.controller.js";
import { createAccountDeletionServiceMiddleware } from "./account-deletion.middleware.js";
import { createAuthSessionRateLimiter } from "../../security/index.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";

export function createUserProfileRouter(options: {
  config: Readonly<ApplicationConfig>;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
  activeAccountMiddleware?: RequestHandler;
  serviceMiddleware?: RequestHandler;
  deletionServiceMiddleware?: RequestHandler;
}): Router {
  const router = Router();

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });

  const activeAccountMiddleware =
    options.activeAccountMiddleware ?? createRequireActiveAccountMiddleware(options.config);

  const serviceMiddleware =
    options.serviceMiddleware ?? createUserProfileServiceMiddleware(options.config);

  const deletionServiceMiddleware =
    options.deletionServiceMiddleware ?? createAccountDeletionServiceMiddleware(options.config);

  const deletionLimiter = createAuthSessionRateLimiter(options.config);

  router.get(
    "/me",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    serviceMiddleware,
    createGetMeController(),
  );

  router.patch(
    "/me",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    serviceMiddleware,
    createUpdateMeController(),
  );

  router.delete(
    "/me",
    authNoStoreMiddleware,
    deletionLimiter,
    authMiddleware,
    deletionServiceMiddleware,
    createDeleteMeController(options.config),
  );

  return router;
}
