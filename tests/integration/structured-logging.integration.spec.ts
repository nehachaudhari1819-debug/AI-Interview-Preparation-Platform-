import { jest } from "@jest/globals";
import request from "supertest";
import { Writable } from "node:stream";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express, { Router } from "express";

describe("structured-logging.integration", () => {
  let app: express.Express;
  let logOutput: any[] = [];
  let observability: ReturnType<typeof bootstrapObservability>;

  beforeEach(() => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        try {
          logOutput.push(JSON.parse(chunk.toString()));
        } catch {
          // Ignore invalid JSON
        }
        callback();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "info",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "test-service",
        appVersion: "1.0.0",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 1000,
      },
    });

    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server, destination: logStream });
    
    const apiRouter = Router();
    apiRouter.get("/success", (req, res) => {
      res.status(200).json({ message: "ok" });
    });
    apiRouter.get("/error", () => {
      throw new Error("Test error message");
    });
    
    app = createApp({ config, observability, configSummary: createSafeConfigSummary(config), apiRouter });
    
    server.removeAllListeners("request");
    server.on("request", app);
  });

  afterEach(() => {
    observability.unregisterProcessHandlers();
  });

  it("produces a valid JSON completion event for a real request", async () => {
    const res = await request(app)
      .get("/api/v1/success?secret=123")
      .set("Cookie", "session=123")
      .set("Authorization", "Bearer token123");

    expect(res.status).toBe(200);

    const completionLog = logOutput.find((log) => log.event === "http.request.completed");
    expect(completionLog).toBeDefined();
    
    expect(completionLog.requestId).toBe(res.headers["x-request-id"]);

    expect(completionLog.method).toBe("GET");
    expect(completionLog.path).toBe("/api/v1/success");
    expect(completionLog.statusCode).toBe(200);
    expect(typeof completionLog.durationMs).toBe("number");
    expect(completionLog.outcome).toBe("success");

    expect(completionLog.path).not.toContain("secret=123");
    
    expect(completionLog.body).toBeUndefined();
    expect(completionLog.responseBody).toBeUndefined();
    expect(completionLog.req?.headers?.authorization).toBeUndefined();
    expect(completionLog.req?.headers?.cookie).toBeUndefined();
  });

  it("produces one safe error event for an error request", async () => {
    const res = await request(app).get("/api/v1/error");
    expect(res.status).toBe(500);

    const errorLog = logOutput.find((log) => log.event === "http.request.error");
    expect(errorLog).toBeDefined();

    expect(errorLog.error).toBeDefined();
    expect(errorLog.error.stack).toBeUndefined();
    expect(errorLog.error.category).toBe("unexpected");
    expect(errorLog.error.fingerprint).toBeDefined();
  });
});
