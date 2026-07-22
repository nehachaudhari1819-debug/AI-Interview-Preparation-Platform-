import { jest } from "@jest/globals";
import request from "supertest";
import { Writable } from "node:stream";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express, { Router } from "express";

describe("logging-client-ip-privacy.security", () => {
  let app: express.Express;
  let logOutput: string[] = [];
  let observability: ReturnType<typeof bootstrapObservability>;
  let configOverrides: any = {};

  const setupApp = () => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput.push(chunk.toString());
        callback();
      },
    });

    const config = createTestApplicationConfig(configOverrides);
    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server, destination: logStream });

    const apiRouter = Router();
    apiRouter.get("/test", (req, res) => {
      res.status(200).json({ ok: true });
    });

    app = createApp({
      config,
      observability,
      configSummary: createSafeConfigSummary(config),
      apiRouter,
    });

    server.removeAllListeners("request");
    server.on("request", app);
  };

  afterEach(() => {
    observability.unregisterProcessHandlers();
  });

  describe("Omit mode", () => {
    beforeEach(() => {
      configOverrides = {
        observability: {
          logLevel: "info",
          pretty: false,
          logHealthRequests: false,
          clientIpMode: "omit",
          serviceName: "test",
          appVersion: "1",
          gitCommitSha: "abc",
          shutdownGracePeriodMs: 5000,
        },
      };
      setupApp();
    });

    it("excludes raw IPv4, IPv6, forwarded headers and clientId", async () => {
      await request(app)
        .get("/api/v1/test")
        .set("X-Forwarded-For", "192.168.1.1")
        .set("X-Real-IP", "10.0.0.1");

      const log = logOutput.find((l) => l.includes("http.request.completed"));
      expect(log).not.toContain("192.168.1.1");
      expect(log).not.toContain("10.0.0.1");
      expect(log).not.toContain("clientId");
      expect(log).not.toContain("remoteAddress");
    });
  });

  describe("Hash mode", () => {
    beforeEach(() => {
      configOverrides = {
        observability: {
          logLevel: "info",
          pretty: false,
          logHealthRequests: false,
          clientIpMode: "hash",
          clientIpHashKey: "fake-client-ip-hash-key-1234567890",
          serviceName: "test",
          appVersion: "1",
          gitCommitSha: "abc",
          shutdownGracePeriodMs: 5000,
        },
      };
      setupApp();
    });

    it("hashes IP, excludes raw IP and hash key", async () => {
      await request(app).get("/api/v1/test").set("X-Forwarded-For", "192.168.1.1");

      const log = logOutput.find((l) => l.includes("http.request.completed")) as string;
      const parsed = JSON.parse(log);

      expect(parsed.clientId).toBeDefined();
      expect(parsed.clientId.length).toBeGreaterThan(10);

      expect(log).not.toContain("192.168.1.1");
      expect(log).not.toContain("fake-client-ip-hash-key-1234567890");
    });
  });
});
