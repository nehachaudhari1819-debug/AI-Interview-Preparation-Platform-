import { Router } from "express";
import type { HealthController } from "./health.controller.js";

export type CreateHealthRouterOptions = {
  healthController: HealthController;
};

export function createHealthRouter({ healthController }: CreateHealthRouterOptions): Router {
  const router = Router();

  router.get("/", (req, res) => healthController.getLiveness(req, res));
  router.get("/ready", (req, res) => healthController.getReadiness(req, res));
  router.get("/config", (req, res) => healthController.getConfig(req, res));

  return router;
}
