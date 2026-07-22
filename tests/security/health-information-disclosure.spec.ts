import { jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express from "express";

describe("health-information-disclosure.security", () => {
  let app: express.Express;
  let observability: ReturnType<typeof bootstrapObservability>;

  beforeEach(() => {
    const config = createTestApplicationConfig({
      supabase: {
        configured: true,
        url: "fake-supabase-url",
        publishableKey: "fake-supabase-anon-key",
        privilegedKey: "fake-supabase-service-role-key",
        privilegedKeyType: "secret",
      },
      observability: {
        logLevel: "silent",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "hash",
        clientIpHashKey: "fake-client-ip-hash-key",
        serviceName: "test",
        appVersion: "1",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 5000,
      },
    });

    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server });

    app = createApp({ config, observability, configSummary: createSafeConfigSummary(config) });
    server.removeAllListeners("request");
    server.on("request", app);
  });

  afterEach(() => {
    observability.unregisterProcessHandlers();
  });

  it("verifies health responses exclude fake secrets and sensitive config", async () => {
    const res = await request(app).get("/health/config");
    expect(res.status).toBe(200);

    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("fake-supabase-url");
    expect(bodyStr).not.toContain("fake-supabase-anon-key");
    expect(bodyStr).not.toContain("fake-supabase-service-role-key");
    expect(bodyStr).not.toContain("fake-client-ip-hash-key");

    expect(res.body.hostname).toBeUndefined();
    expect(res.body.workingDirectory).toBeUndefined();
    expect(res.body.processArguments).toBeUndefined();
    expect(res.body.username).toBeUndefined();
    expect(res.body.processEnv).toBeUndefined();
  });
});
