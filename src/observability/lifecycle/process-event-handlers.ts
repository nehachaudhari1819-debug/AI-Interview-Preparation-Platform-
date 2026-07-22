import type { GracefulShutdownController } from "./graceful-shutdown-controller.js";
import type { ApplicationLifecycle } from "./application-lifecycle.js";
import type { ApplicationLogger } from "../logging/application-logger.types.js";
import { LOG_EVENTS } from "../logging/logging-events.constants.js";
import { safeErrorSerializer } from "../logging/safe-error-serializer.js";

export type RegisterProcessEventHandlersOptions = {
  shutdownController: GracefulShutdownController;
  lifecycle: ApplicationLifecycle;
  logger: ApplicationLogger;
  processTarget?: NodeJS.Process;
};

export function registerProcessEventHandlers({
  shutdownController,
  lifecycle,
  logger,
  processTarget = process,
}: RegisterProcessEventHandlersOptions): () => void {
  const onSigInt = () => {
    shutdownController.shutdown("SIGINT", 0).catch(() => {});
  };

  const onSigTerm = () => {
    shutdownController.shutdown("SIGTERM", 0).catch(() => {});
  };

  const onUncaughtException = (error: Error) => {
    const { state } = lifecycle.getSnapshot();
    if (state !== "failed" && state !== "stopped") {
      try {
        lifecycle.markFailed("uncaught_exception");
      } catch {}
    }

    logger.fatal({
      event: LOG_EVENTS.processUncaughtException,
      message: "Uncaught exception",
      error: safeErrorSerializer(error),
    });

    shutdownController.shutdown("uncaught_exception", 1).catch(() => {});
  };

  const onUnhandledRejection = (reason: unknown) => {
    const { state } = lifecycle.getSnapshot();
    if (state !== "failed" && state !== "stopped") {
      try {
        lifecycle.markFailed("unhandled_rejection");
      } catch {}
    }

    logger.fatal({
      event: LOG_EVENTS.processUnhandledRejection,
      message: "Unhandled promise rejection",
      error: safeErrorSerializer(reason),
    });

    shutdownController.shutdown("unhandled_rejection", 1).catch(() => {});
  };

  processTarget.on("SIGINT", onSigInt);
  processTarget.on("SIGTERM", onSigTerm);
  processTarget.on("uncaughtException", onUncaughtException);
  processTarget.on("unhandledRejection", onUnhandledRejection);

  return () => {
    processTarget.removeListener("SIGINT", onSigInt);
    processTarget.removeListener("SIGTERM", onSigTerm);
    processTarget.removeListener("uncaughtException", onUncaughtException);
    processTarget.removeListener("unhandledRejection", onUnhandledRejection);
  };
}
