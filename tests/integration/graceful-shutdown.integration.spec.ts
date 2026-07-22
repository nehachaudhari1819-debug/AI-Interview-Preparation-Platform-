import { jest } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import { startServer } from "../../src/server.js";
import express, { Router } from "express";
import type { AddressInfo } from "node:net";

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
      if ((app as any).onLongRequest) {
        (app as any).onLongRequest();
      }
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
    const originalListen = server.listen.bind(server);
    // @ts-expect-error intercept listen to force IPv4
    server.listen = (port: number, cb?: () => void) => {
      return originalListen(port, "127.0.0.1", cb);
    };

    const listenSpy = jest.spyOn(server, "listen");
    const closeSpy = jest.spyOn(server, "close");

    startServer({ server, port: 0, observability });

    // Wait for the server to actually listen
    await new Promise((resolve) => {
      if (server.listening) resolve(null);
      else server.once("listening", resolve);
    });

    expect(server.listening).toBe(true);

    let longRes: any;
    let longErr: any;
    const longReqPromise = new Promise<void>((resolve) => {
      request(server)
        .get("/api/v1/long")
        .end((err, res) => {
          longErr = err;
          longRes = res;
          resolve();
        });
    });

    // We MUST wait for the request to actually reach the router to be considered "in-flight"
    // Let's poll until the router flags it as received.
    let inFlight = false;
    (app as any).onLongRequest = () => {
      inFlight = true;
    };

    while (!inFlight) {
      await new Promise((r) => setTimeout(r, 5));
    }

    const shutdownPromise = observability.shutdownController.shutdown("SIGTERM", 0);

    const readyRes = await request(app).get("/health/ready");
    expect(readyRes.status).toBe(503);

    const newWorkRes = await request(app).get("/api/v1/long");
    expect(newWorkRes.status).toBe(503);

    (app as any).finishLongRequest();
    await longReqPromise;
    if (longErr) throw longErr;
    expect(longRes.status).toBe(200);

    await shutdownPromise;

    expect(closeSpy).toHaveBeenCalled();
    expect(server.listening).toBe(false);
  });
});
