import { jest } from "@jest/globals";
import { registerProcessEventHandlers } from "../../../../src/observability/lifecycle/process-event-handlers.js";
import type { GracefulShutdownController } from "../../../../src/observability/lifecycle/graceful-shutdown-controller.js";
import type { ApplicationLifecycle } from "../../../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import EventEmitter from "node:events";

describe("process-event-handlers", () => {
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
      child: jest.fn() as any,
      flush: jest.fn(),
    };

    processTarget = new EventEmitter() as NodeJS.Process;
  });

  afterEach(() => {
    unregister();
  });

  it("registers no listeners during module import", () => {
    expect(processTarget.listenerCount("SIGINT")).toBe(0);
  });

  it("SIGINT invokes graceful shutdown with exit code 0", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    processTarget.emit("SIGINT", "SIGINT");
    expect(shutdownController.shutdown).toHaveBeenCalledWith("SIGINT", 0);
  });

  it("SIGTERM invokes graceful shutdown with exit code 0", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    processTarget.emit("SIGTERM", "SIGTERM");
    expect(shutdownController.shutdown).toHaveBeenCalledWith("SIGTERM", 0);
  });

  it("uncaughtException marks lifecycle failed and starts shutdown with exit code 1", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    const error = new Error("Test uncaught exception");
    processTarget.emit("uncaughtException", error);

    expect(lifecycle.markFailed).toHaveBeenCalledWith("uncaught_exception");
    expect(logger.fatal).toHaveBeenCalled();
    const logCall = (logger.fatal as any).mock.calls[0][0];
    expect(logCall.event).toBe("process.uncaught_exception");
    expect(logCall.error).toBeDefined();
    expect(logCall.error.name).toBe("Error");
    expect(logCall.error.fingerprint).toBeDefined();

    expect(shutdownController.shutdown).toHaveBeenCalledWith("uncaught_exception", 1);
  });

  it("unhandledRejection marks lifecycle failed and starts shutdown with exit code 1", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    const error = new Error("Test unhandled rejection");
    processTarget.emit("unhandledRejection", error, Promise.reject(error));

    expect(lifecycle.markFailed).toHaveBeenCalledWith("unhandled_rejection");
    expect(logger.fatal).toHaveBeenCalled();
    const logCall = (logger.fatal as any).mock.calls[0][0];
    expect(logCall.event).toBe("process.unhandled_rejection");
    expect(logCall.error).toBeDefined();
    expect(logCall.error.name).toBe("Error");

    expect(shutdownController.shutdown).toHaveBeenCalledWith("unhandled_rejection", 1);
  });

  it("excludes passwords and cookies from logged rejection value", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    const rejectionValue = {
      password: "secret-password",
      cookie: "some-cookie",
      message: "Something failed",
    };
    processTarget.emit(
      "unhandledRejection",
      rejectionValue,
      Promise.reject(new Error("Something failed")),
    );

    const logCall = (logger.fatal as any).mock.calls[0][0];
    expect(logCall.error.category).toBe("unexpected");
    expect(logCall.error.password).toBeUndefined();
    expect(logCall.error.cookie).toBeUndefined();
  });

  it("duplicate shutdown execution is prevented via the controller, process handles pass calls to controller", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    processTarget.emit("SIGTERM", "SIGTERM");
    processTarget.emit("SIGTERM", "SIGTERM");
    expect(shutdownController.shutdown).toHaveBeenCalledTimes(2); // Controller handles deduplication internally
  });

  it("returned unregister function removes every listener", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    expect(processTarget.listenerCount("SIGINT")).toBe(1);
    expect(processTarget.listenerCount("SIGTERM")).toBe(1);
    expect(processTarget.listenerCount("uncaughtException")).toBe(1);
    expect(processTarget.listenerCount("unhandledRejection")).toBe(1);

    unregister();

    expect(processTarget.listenerCount("SIGINT")).toBe(0);
    expect(processTarget.listenerCount("SIGTERM")).toBe(0);
    expect(processTarget.listenerCount("uncaughtException")).toBe(0);
    expect(processTarget.listenerCount("unhandledRejection")).toBe(0);
  });

  it("does not call process.exit() directly", () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exited");
    });
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    processTarget.emit("SIGINT", "SIGINT");
    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it("does not return lifecycle to ready state when fatal failures occur", () => {
    unregister = registerProcessEventHandlers({
      shutdownController,
      lifecycle,
      logger,
      processTarget,
    });
    processTarget.emit("uncaughtException", new Error("Fatal"));
    expect(lifecycle.markReady).not.toHaveBeenCalled();
  });
});
