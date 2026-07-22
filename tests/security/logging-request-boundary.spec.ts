import { jest } from "@jest/globals";
import request from "supertest";
import { Writable } from "node:stream";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express, { Router } from "express";

describe("logging-request-boundary.security", () => {
  let app: express.Express;
  let logOutput: string[] = [];
  let observability: ReturnType<typeof bootstrapObservability>;

  beforeEach(() => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput.push(chunk.toString());
        callback();
      },
    });

    const config = createTestApplicationConfig();
    const tempApp = express();
    const server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server, destination: logStream });

    const apiRouter = Router();
    apiRouter.post("/test", (req, res) => {
      res.status(200).json({ responseBody: "secret_response" });
    });

    app = createApp({
      config,
      observability,
      configSummary: createSafeConfigSummary(config),
      apiRouter,
    });

    server.removeAllListeners("request");
    server.on("request", app);
  });

  afterEach(() => {
    observability.unregisterProcessHandlers();
  });

  it("verifies request logs exclude sensitive and unnecessary fields", async () => {
    await request(app)
      .post("/api/v1/test?secret_query=123")
      .set("Authorization", "Bearer token123")
      .set("Cookie", "session=xyz")
      .send({ body_secret: "123456", email: "test@example.com", password: "password123" });

    const completionLog = logOutput.find((out) => out.includes("http.request.completed"));
    expect(completionLog).toBeDefined();

    expect(completionLog).not.toContain("body_secret");
    expect(completionLog).not.toContain("secret_response");
    expect(completionLog).not.toContain("secret_query");
    expect(completionLog).not.toContain("token123");
    expect(completionLog).not.toContain("session=xyz");
    expect(completionLog).not.toContain("test@example.com");
    expect(completionLog).not.toContain("password123");

    // Check allowlisted fields
    const parsed = JSON.parse(completionLog as string);
    expect(parsed.method).toBe("POST");
    expect(parsed.path).toBe("/api/v1/test");
    expect(parsed.statusCode).toBe(200);
  });
});
