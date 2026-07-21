import { Router } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { createAuthRouter } from "../features/auth/auth.router.js";

export function createApiV1Router(config: Readonly<ApplicationConfig>): Router {
  const router = Router();

  const authRouter = createAuthRouter({ config });
  router.use("/auth", authRouter);

  return router;
}
