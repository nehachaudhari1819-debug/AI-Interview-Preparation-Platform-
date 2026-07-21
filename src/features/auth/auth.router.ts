import { Router } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { createAuthApiRateLimitMiddleware } from "./create-auth-api-rate-limit.middleware.js";
import { authNoStoreMiddleware } from "./auth-no-store.middleware.js";
import {
  createLoginController,
  createLogoutController,
  createMeController,
  createRefreshController,
  createRegisterController,
} from "./auth.controller.js";
import { createAuthService } from "./auth.service.js";

export function createAuthRouter(options: {
  config: Readonly<ApplicationConfig>;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
  authService?: ReturnType<typeof createAuthService>;
}): Router {
  const router = Router();
  const service = options.authService ?? createAuthService({ config: options.config });

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });
  const rateLimitMiddleware = createAuthApiRateLimitMiddleware(options.config);

  router.use(authNoStoreMiddleware);

  router.post("/register", rateLimitMiddleware, createRegisterController(options.config, service));

  router.post("/login", rateLimitMiddleware, createLoginController(options.config, service));

  router.post("/refresh", rateLimitMiddleware, createRefreshController(options.config, service));

  router.post("/logout", createLogoutController(options.config, service));

  router.get("/me", authMiddleware, createMeController());

  return router;
}
