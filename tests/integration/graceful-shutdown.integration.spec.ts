import { jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import { startServer } from "../../src/server.js";
import express, { Router } from "express";

describe("graceful-shutdown.integration", () => {
  let app: express.Express;
  let observability: ReturnType<typeof bootstrapObservability>;
  let server: ReturnType<typeof createHttpServer>;

  beforeEach(() => {
    const config = createTestApplicationConfig({
      observability: {
        logLevel: "silent",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "ai-interview-preparation-platform-backend",
        appVersion: "1",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 5000,
      },
    });

    const tempApp = express();
    server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server });
    observability.unregisterProcessHandlers();

    let finishLongRequest: () => void = () => {};
    const longRequestPromise = new Promise<void>((resolve) => {
      finishLongRequest = resolve;
    });

    const apiRouter = Router();
    apiRouter.get("/long", async (req, res) => {
      await longRequestPromise;
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
    (app as any).finishLongRequest = finishLongRequest;
  });

  afterEach((done) => {
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it("completes graceful shutdown lifecycle", async () => {
    const listenSpy = jest.spyOn(server, "listen");
    const closeSpy = jest.spyOn(server, "close");

    startServer({ server, port: 0, observability });

    // Wait for the server to actually listen
    await new Promise((resolve) => {
      if (server.listening) resolve(null);
      else server.once("listening", resolve);
    });

    expect(server.listening).toBe(true);

    const longReqPromise = request(server).get("/api/v1/long");
    await new Promise((resolve) => setTimeout(resolve, 50)); // Ensure it's in flight

    const shutdownPromise = observability.shutdownController.shutdown("SIGTERM", 0);

    const readyRes = await request(server).get("/health/ready");
    expect(readyRes.status).toBe(503);

    const newWorkRes = await request(server).get("/api/v1/long");
    expect(newWorkRes.status).toBe(503);

    (app as any).finishLongRequest();
    const longRes = await longReqPromise;
    expect(longRes.status).toBe(200);

    await shutdownPromise;

    expect(closeSpy).toHaveBeenCalled();
    expect(server.listening).toBe(false);
  });
});
