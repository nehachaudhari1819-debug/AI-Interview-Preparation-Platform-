import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export type HealthController = {
  getLiveness(req: Request, res: Response): void;
  getReadiness(req: Request, res: Response): void;
  getConfig(req: Request, res: Response): void;
};

export type CreateHealthControllerOptions = {
  healthService: HealthService;
};

export function createHealthController({ healthService }: CreateHealthControllerOptions): HealthController {
  return {
    getLiveness(req, res) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.status(200).json(healthService.getLiveness());
    },
    getReadiness(req, res) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      const result = healthService.getReadiness();
      const status = result.status === "ready" ? 200 : 503;
      res.status(status).json(result);
    },
    getConfig(req, res) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.status(200).json(healthService.getConfig());
    },
  };
}
