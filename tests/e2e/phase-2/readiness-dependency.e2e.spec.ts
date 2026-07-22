import request from "supertest";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import type { Express } from "express";
import type { Server } from "node:http";
import type { ApplicationLifecycle } from "../../../src/observability/lifecycle/application-lifecycle.js";
import { createApplicationLifecycle } from "../../../src/observability/lifecycle/application-lifecycle.js";
import { createApplicationLogger } from "../../../src/observability/logging/create-application-logger.js";
import { createHealthService } from "../../../src/api/health/health.service.js";
import { createHealthController } from "../../../src/api/health/health.controller.js";
import { appConfig, createTestApp } from "../../setup/real-environment.js";

describe("Real Environment: Readiness & Dependency Behavior", () => {
  let app: Express;
  let server: Server;
  let lifecycle: ApplicationLifecycle;

  beforeAll(() => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;
  });

  afterAll(() => {
    server.close();
  });

  it("returns ready state under healthy conditions", async () => {
    const response = await request(app).get("/health/ready").expect(HTTP_STATUS.OK);

    expect(response.body.status).toBe("ready");
    expect(response.body.state).toBe("ready");
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("fails safely without exposing internals when dependency is unavailable", async () => {
    // To simulate dependency failure safely without breaking the global real environment,
    // we use a test double of the lifecycle to transition into a non-ready state.
    const customLifecycle = createApplicationLifecycle();
    // Start it, then initiate shutdown to transition out of 'ready'
    customLifecycle.markReady();
    customLifecycle.beginShutdown("test");

    const customHealthService = createHealthService({
      lifecycle: customLifecycle,
      logger: createApplicationLogger({ config: appConfig }),
      configSummary: { supabaseConfigured: true } as unknown as any,
    });
    const customController = createHealthController({ healthService: customHealthService });
    // We can simulate an express route for it
    const expressModule = await import("express");
    const testApp = expressModule.default();
    testApp.get("/health/ready", customController.getReadiness);

    const response = await request(testApp)
      .get("/health/ready")
      .expect(HTTP_STATUS.SERVICE_UNAVAILABLE);

    expect(response.body.status).toBe("unavailable");
    // No hostnames, secrets, or internal details exposed
    expect(JSON.stringify(response.body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("fails authentication safely when supabase is unreachable (Service Unavailable)", async () => {
    // We will mount a new express app with a mangled Supabase URL to simulate unreachability.
    const badConfig = {
      ...appConfig,
      supabase: {
        ...appConfig.supabase,
        url: "http://127.0.0.1:9999", // Unreachable port
        anonKey: "test-anon-key",
        privilegedKey: "test-priv-key",
      },
    };
    const badHttpServer = createTestApp(badConfig);

    // Set a very short timeout for the test to prove bounded timeout behavior
    const response = await request(badHttpServer.app)
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "Password1!" })
      .timeout(3000) // Bounded timeout
      .expect(HTTP_STATUS.SERVICE_UNAVAILABLE); // Since it never marks ready, it fails admission with 503

    const body = response.body;

    // Verify no raw network error, hostnames, or credentials
    expect(response.text).not.toContain("127.0.0.1:9999");
    expect(response.text).not.toContain("ECONNREFUSED");
    expect(response.text).not.toContain("test-anon-key");
    if (body) {
      expect(body.meta?.requestId).toBeDefined();
    }

    badHttpServer.server.close();
  });
});
