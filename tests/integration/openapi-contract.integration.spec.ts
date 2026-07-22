import request from "supertest";
import { openApiDocument } from "../../src/openapi/openapi-document.js";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express from "express";

describe("OpenAPI Contract Integration", () => {
  it("should match runtime health response structure", async () => {
    const config = createTestApplicationConfig();
    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    const observability = bootstrapObservability({ config, server });
    observability.lifecycle.markReady(); // Mark ready for the 200 response

    const app = createApp({
      config,
      observability,
      configSummary: createSafeConfigSummary(config),
    });

    // Check liveness matches contract
    const livenessRes = await request(app).get("/health");
    expect(livenessRes.status).toBe(200);
    expect(livenessRes.body).toHaveProperty("status", "ok");

    // OpenAPI Contract says LivenessSuccess schema has status "ok"
    const livenessSchema = openApiDocument.components?.schemas?.["LivenessResponse"] as any;
    expect(livenessSchema.properties.status.enum).toContain(livenessRes.body.status);

    // Check readiness matches contract
    const readinessRes = await request(app).get("/health/ready");
    expect(readinessRes.status).toBe(200); // 200 because we configured supabase correctly
    expect(readinessRes.body).toHaveProperty("status", "ready");
    expect(readinessRes.body).toHaveProperty("uptime");

    const readinessSchema = openApiDocument.components?.schemas?.["ReadinessReadyResponse"] as any;
    expect(readinessSchema.properties.status.enum).toContain("ready");
    observability.unregisterProcessHandlers();
  });

  it("should respond with JSON for missing routes under API", async () => {
    const config = createTestApplicationConfig();
    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    const observability = bootstrapObservability({ config, server });

    const app = createApp({
      config,
      observability,
      configSummary: createSafeConfigSummary(config),
    });

    const notFoundRes = await request(app).get("/api/v1/some-unknown-route");
    expect(notFoundRes.status).toBe(404);

    // Should match StandardErrorResponse
    expect(notFoundRes.body).toHaveProperty("success", false);
    expect(notFoundRes.body).toHaveProperty("code", "RESOURCE_NOT_FOUND");
    expect(notFoundRes.body).toHaveProperty("meta");

    observability.unregisterProcessHandlers();
  });
});
