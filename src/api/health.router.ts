import { Router } from "express";
import type { ApplicationLifecycle } from "../observability/lifecycle/application-lifecycle.js";
import { LOG_EVENTS } from "../observability/logging/logging-events.constants.js";
import type { ApplicationLogger } from "../observability/logging/application-logger.types.js";
import type { ReadonlyDeep } from "type-fest";
import type { SafeConfigSummary } from "../config/config-summary.js";

export type CreateHealthRouterOptions = {
  lifecycle: ApplicationLifecycle;
  logger: ApplicationLogger;
  configSummary: ReadonlyDeep<SafeConfigSummary>;
};

export function createHealthRouter({
  lifecycle,
  logger,
  configSummary,
}: CreateHealthRouterOptions): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/ready", (req, res) => {
    const snapshot = lifecycle.getSnapshot();

    if (snapshot.state !== "ready") {
      logger.warn({
        event: LOG_EVENTS.readinessFailed,
        state: snapshot.state,
        message: "Readiness probe failed. Application is not ready.",
      });

      res.status(503).json({
        status: "unavailable",
        state: snapshot.state,
      });
      return;
    }

    res.status(200).json({
      status: "ready",
      state: snapshot.state,
      uptime: Date.now() - new Date(snapshot.startedAt).getTime(),
    });
  });

  router.get("/config", (req, res) => {
    res.status(200).json(configSummary);
  });

  return router;
}
