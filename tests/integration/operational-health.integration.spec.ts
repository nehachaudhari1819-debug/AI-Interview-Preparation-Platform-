import { jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express from "express";

describe("operational-health.integration", () => {
  let app: express.Express;
  let observability: ReturnType<typeof bootstrapObservability>;

  beforeEach(() => {
    const config = createTestApplicationConfig();
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

  it("Starting readiness returns 503", async () => {
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
  });

  it("Ready state returns 200", async () => {
    observability.lifecycle.markReady();
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
  });

  it("Shutdown readiness returns 503", async () => {
    observability.lifecycle.markReady();
    observability.lifecycle.beginShutdown();
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
  });

  it("Failed readiness returns 503", async () => {
    observability.lifecycle.markFailed("uncaught_exception");
    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
  });

  it("Liveness remains 200 during shutdown", async () => {
    observability.lifecycle.markReady();
    observability.lifecycle.beginShutdown();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("Helmet headers remain present", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-dns-prefetch-control"]).toBeDefined();
  });

  it("No-store headers remain present", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("Request ID is present", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("Safe version and commit metadata are present", async () => {
    const res = await request(app).get("/health/config");
    expect(res.body.appVersion).toBeDefined();
    expect(res.body.gitCommitSha).toBeDefined();
  });

  it("Supabase URL, keys, hash key, hostname, working directory, and process arguments are absent", async () => {
    const res = await request(app).get("/health/config");
    expect(res.body.supabaseUrl).toBeUndefined();
    expect(res.body.supabaseAnonKey).toBeUndefined();
    expect(res.body.supabaseServiceRoleKey).toBeUndefined();
    expect(res.body.clientIpHashKey).toBeUndefined();
    expect(res.body.hostname).toBeUndefined();
    expect(res.body.workingDirectory).toBeUndefined();
    expect(res.body.processArguments).toBeUndefined();
  });
});
