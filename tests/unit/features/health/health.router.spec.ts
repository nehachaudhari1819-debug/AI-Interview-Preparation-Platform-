import request from "supertest";
import express from "express";
import {
  createHealthRouter,
  createHealthController,
  createHealthService,
} from "../../../../src/api/health/index.js";
import type { ApplicationLifecycle } from "../../../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";
import { createSafeConfigSummary } from "../../../../src/config/index.js";
import { requestIdMiddleware } from "../../../../src/middleware/request-id.middleware.js";

describe("health.router", () => {
  let app: express.Express;
  let lifecycleState: string = "ready";

  beforeEach(() => {
    app = express();
    app.use(requestIdMiddleware);

    const lifecycle = {
      getSnapshot: () => ({
        state: lifecycleState,
        ready: lifecycleState === "ready",
        startedAt: new Date().toISOString(),
        updatedAt: "",
      }),
      markReady: () => {},
      beginShutdown: () => {},
      markStopped: () => {},
      markFailed: () => {},
    } as unknown as ApplicationLifecycle;

    const logger = {
      warn: () => {},
      info: () => {},
    } as unknown as ApplicationLogger;

    const config = createTestApplicationConfig();
    const configSummary = createSafeConfigSummary(config);

    const healthService = createHealthService({ lifecycle, logger, configSummary });
    const healthController = createHealthController({ healthService });
    const healthRouter = createHealthRouter({ healthController });

    app.use("/health", healthRouter);
  });

  it("GET /health returns 200", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /health/ready returns 200 while ready", async () => {
    lifecycleState = "ready";
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
  });

  it("GET /health/ready returns 503 while not ready", async () => {
    lifecycleState = "starting";
    const response = await request(app).get("/health/ready");
    expect(response.status).toBe(503);
    expect(response.body.status).toBe("unavailable");
  });

  it("No authentication is required", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
  });

  it("No CSRF protection is required", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
  });

  it("Stable response envelopes are preserved", async () => {
    const response = await request(app).get("/health");
    expect(response.body).toHaveProperty("status");
  });
});
