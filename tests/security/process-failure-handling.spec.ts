import { jest } from "@jest/globals";
import { registerProcessEventHandlers } from "../../src/observability/lifecycle/process-event-handlers.js";
import type { GracefulShutdownController } from "../../src/observability/lifecycle/graceful-shutdown-controller.js";
import type { ApplicationLifecycle } from "../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../src/observability/logging/application-logger.types.js";
import EventEmitter from "node:events";

describe("process-failure-handling.security", () => {
  let shutdownController: jest.Mocked<GracefulShutdownController>;
  let lifecycle: jest.Mocked<ApplicationLifecycle>;
  let logger: jest.Mocked<ApplicationLogger>;
  let processTarget: NodeJS.Process;
  let unregister: () => void;

  beforeEach(() => {
    shutdownController = {
      shutdown: jest.fn<GracefulShutdownController["shutdown"]>().mockResolvedValue(undefined),
      isShuttingDown: jest
        .fn<GracefulShutdownController["isShuttingDown"]>()
        .mockReturnValue(false),
    };

    lifecycle = {
      getSnapshot: jest.fn<ApplicationLifecycle["getSnapshot"]>().mockReturnValue({
        state: "ready",
        ready: true,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      markReady: jest.fn(),
      beginShutdown: jest.fn(),
      markStopped: jest.fn(),
      markFailed: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn().mockReturnThis(),
      flush: jest.fn(),
    };

    processTarget = new EventEmitter() as NodeJS.Process;
  });

  afterEach(() => {
    unregister();
  });

  it("handles uncaughtException safely", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });

    const err = new Error("Fatal failure");
    (err as any).password = "secret-pass";

    processTarget.emit("uncaughtException", err, "uncaughtException");

    expect(lifecycle.markFailed).toHaveBeenCalledWith("uncaught_exception");
    expect(shutdownController.shutdown).toHaveBeenCalledWith("uncaught_exception", 1);

    expect(logger.fatal).toHaveBeenCalled();
    const callArgs = logger.fatal.mock.calls[0][0] as Record<string, any>;

    expect(callArgs.event).toBe("process.uncaught_exception");
    expect(callArgs.error.password).toBeUndefined();
    expect(lifecycle.markReady).not.toHaveBeenCalled();
  });
});
