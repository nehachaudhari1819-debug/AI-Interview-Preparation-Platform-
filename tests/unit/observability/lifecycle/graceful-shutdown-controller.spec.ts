import { jest } from "@jest/globals";
import type { ApplicationConfig } from "../../../../src/config/app-config.js";
import {
  createGracefulShutdownController,
  type GracefulShutdownController,
} from "../../../../src/observability/lifecycle/graceful-shutdown-controller.js";
import {
  createApplicationLifecycle,
  type ApplicationLifecycle,
} from "../../../../src/observability/lifecycle/application-lifecycle.js";
import {
  createInFlightRequestTracker,
  type InFlightRequestTracker,
} from "../../../../src/observability/lifecycle/in-flight-request-tracker.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import { createHttpServer } from "../../../../src/server/create-http-server.js";
import express from "express";

describe("Graceful Shutdown Controller", () => {
  let mockLogger: jest.Mocked<ApplicationLogger>;
  let lifecycle: ApplicationLifecycle;
  let tracker: InFlightRequestTracker;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn() as any,
      flush: jest.fn(),
    };
    lifecycle = createApplicationLifecycle();
    tracker = createInFlightRequestTracker();
  });

  it("coordinates shutdown correctly", async () => {
    const server = createHttpServer(express(), {
      observability: { shutdownGracePeriodMs: 1000 },
      httpServer: {
        requestTimeoutMs: 30000,
        headersTimeoutMs: 60000,
        keepAliveTimeoutMs: 5000,
        maxHeadersCount: 100,
      },
    } as unknown as ApplicationConfig);
    const serverCloseSpy = jest.spyOn(server, "close").mockImplementation((cb) => {
      if (cb) cb();
      return server;
    });

    const controller = createGracefulShutdownController({
      lifecycle,
      tracker,
      logger: mockLogger,
      server,
      gracePeriodMs: 1000,
    });

    lifecycle.markReady();
    await controller.shutdown("test", 0);

    expect(serverCloseSpy).toHaveBeenCalled();
    expect(lifecycle.getSnapshot().state).toBe("stopped");
    expect(mockLogger.flush).toHaveBeenCalled();
  });
});
