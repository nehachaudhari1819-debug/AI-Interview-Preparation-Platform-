import { Router } from "express";
import type { HealthController } from "./health.controller.js";

export type CreateHealthRouterOptions = {
  healthController: HealthController;
};

export function createHealthRouter({ healthController }: CreateHealthRouterOptions): Router {
  const router = Router();

  router.get("/", healthController.getLiveness);
  router.get("/ready", healthController.getReadiness);
  router.get("/config", healthController.getConfig);

  return router;
}
