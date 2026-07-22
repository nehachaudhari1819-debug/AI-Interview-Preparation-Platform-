import { jest } from "@jest/globals";
import request from "supertest";
import { Writable } from "node:stream";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express, { Router } from "express";

describe("logging-context-isolation.security", () => {
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
    apiRouter.get("/delay", async (req, res) => {
      observability.logger.info("Inside delay before");
      await new Promise(r => setTimeout(r, parseInt(req.query.ms as string) || 10));
      observability.logger.info("Inside delay after");
      res.status(200).json({ ok: true });
    });
    
    app = createApp({ config, observability, configSummary: createSafeConfigSummary(config), apiRouter });
    
    server.removeAllListeners("request");
    server.on("request", app);
  });

  afterEach(() => {
    observability.unregisterProcessHandlers();
  });

  it("isolates context between concurrent requests", async () => {
    const req1 = request(app).get("/api/v1/delay?ms=20").set("X-Request-ID", "req-1");
    const req2 = request(app).get("/api/v1/delay?ms=10").set("X-Request-ID", "req-2");

    await Promise.all([req1, req2]);

    const logs = logOutput.map(l => JSON.parse(l));
    
    const req1Logs = logs.filter(l => l.requestId === "req-1");
    expect(req1Logs.length).toBeGreaterThan(1);
    req1Logs.forEach(l => {
      expect(l.requestId).toBe("req-1");
      expect(l.msg).not.toContain("req-2");
    });

    const req2Logs = logs.filter(l => l.requestId === "req-2");
    expect(req2Logs.length).toBeGreaterThan(1);
    req2Logs.forEach(l => {
      expect(l.requestId).toBe("req-2");
      expect(l.msg).not.toContain("req-1");
    });

    observability.logger.info("Outside context");
    
    const lastLog = JSON.parse(logOutput[logOutput.length - 1]);
    expect(lastLog.msg).toBe("Outside context");
    expect(lastLog.requestId).toBeUndefined();
  });
});
