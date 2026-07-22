import { jest } from "@jest/globals";
import request from "supertest";
import { Writable } from "node:stream";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { bootstrapObservability } from "../../src/observability/index.js";
import { createSafeConfigSummary } from "../../src/config/index.js";
import { createHttpServer } from "../../src/server/create-http-server.js";
import express, { Router } from "express";

describe("graceful-shutdown.security", () => {
  let app: express.Express;
  let observability: ReturnType<typeof bootstrapObservability>;
  let server: ReturnType<typeof createHttpServer>;
  let logOutput: string[] = [];

  beforeEach(() => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput.push(chunk.toString());
        callback();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "info",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "test",
        appVersion: "1",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 50,
      },
    });

    const tempApp = express();
    server = createHttpServer(tempApp, config);
    observability = bootstrapObservability({ config, server, destination: logStream });
    observability.unregisterProcessHandlers();

    let longRequestResolve: () => void;
    const longRequestPromise = new Promise<void>((resolve) => {
      longRequestResolve = resolve;
    });

    const apiRouter = Router();
    apiRouter.post("/long", async (req, res) => {
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
    (app as any).resolveLongRequest = longRequestResolve;
  });

  afterEach((done) => {
    if (server.listening) {
      server.close(done);
    } else {
      done();
    }
  });

  it("forces connection closure and logs safely on timeout", async () => {
    await new Promise((resolve) =>
      server.listen(0, () => {
        resolve(null);
      }),
    );

    request(server)
      .post("/api/v1/long")
      .set("Authorization", "Bearer my-secret")
      .send({ password: "my-password" });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const shutdownPromise = observability.shutdownController.shutdown("test_timeout", 0);

    await shutdownPromise;

    const logs = logOutput.join("");

    expect(logs).toContain("application.shutdown.forced");
    expect(logs).toContain("test_timeout");

    expect(logs).not.toContain("my-secret");
    expect(logs).not.toContain("my-password");

    const parsedLogs = logOutput.map((l) => JSON.parse(l));
    const forcedLog = parsedLogs.find((l) => l.event === "application.shutdown.forced");
    expect(forcedLog).toBeDefined();
    expect(forcedLog.sockets).toBeUndefined();
  });
});
