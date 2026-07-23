import { Router } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { createAuthRouter } from "../features/auth/auth.router.js";
import { createUserProfileRouter } from "../features/users/index.js";

export function createApiV1Router(config: Readonly<ApplicationConfig>): Router {
  const router = Router();

  const authRouter = createAuthRouter({ config });
  router.use("/auth", authRouter);

  const usersRouter = createUserProfileRouter({ config });
  router.use("/users", usersRouter);

  return router;
}
