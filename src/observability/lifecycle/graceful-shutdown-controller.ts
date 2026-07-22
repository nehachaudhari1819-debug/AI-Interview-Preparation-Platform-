import type { Server } from "node:http";
import type { ApplicationLifecycle } from "./application-lifecycle.js";
import type { InFlightRequestTracker } from "./in-flight-request-tracker.js";
import type { ApplicationLogger } from "../logging/application-logger.types.js";
import { LOG_EVENTS } from "../logging/logging-events.constants.js";

export type ShutdownReason =
  | "SIGINT"
  | "SIGTERM"
  | "uncaught_exception"
  | "unhandled_rejection"
  | "startup_failure"
  | "test";

export type GracefulShutdownController = {
  shutdown(reason: ShutdownReason, exitCode: number): Promise<void>;
  isShuttingDown(): boolean;
};

export type CreateGracefulShutdownControllerOptions = {
  server: Server;
  lifecycle: ApplicationLifecycle;
  tracker: InFlightRequestTracker;
  logger: ApplicationLogger;
  gracePeriodMs: number;

  dependencies?: {
    setTimeout?: typeof globalThis.setTimeout;
    clearTimeout?: typeof globalThis.clearTimeout;
    setExitCode?: (code: number) => void;
    flushLogger?: () => Promise<void>;
  };
};

export function createGracefulShutdownController({
  server,
  lifecycle,
  tracker,
  logger,
  gracePeriodMs,
  dependencies = {},
}: CreateGracefulShutdownControllerOptions): GracefulShutdownController {
  const customSetTimeout = dependencies.setTimeout ?? globalThis.setTimeout;
  const customClearTimeout = dependencies.clearTimeout ?? globalThis.clearTimeout;
  const setExitCode = dependencies.setExitCode ?? ((code: number) => { process.exitCode = code; });
  const flushLogger = dependencies.flushLogger ?? (async () => {
    try {
      if (typeof logger.flush === "function") {
        logger.flush();
      }
    } catch {
      // Ignore errors during final flush
    }
  });

  let shutdownPromise: Promise<void> | null = null;

  async function executeShutdown(reason: ShutdownReason, exitCode: number): Promise<void> {
    const { state } = lifecycle.getSnapshot();

    if (state !== "failed") {
      try {
        lifecycle.beginShutdown(reason);
      } catch {
        // Ignore transition error
      }
    }

    setExitCode(exitCode);

    logger.info({
      event: LOG_EVENTS.shutdownStarted,
      reason,
      exitCode,
      message: "Graceful shutdown started.",
    });

    server.close();

    const drainPromise = tracker.waitForZero();
    let graceTimeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<void>((resolve) => {
      graceTimeoutId = customSetTimeout(() => {
        logger.warn({
          event: LOG_EVENTS.shutdownForced,
          message: "Grace period expired. Forcing connections closed.",
        });
        server.closeAllConnections();
        resolve();
      }, gracePeriodMs);
    });

    await Promise.race([drainPromise, timeoutPromise]);
    if (graceTimeoutId !== undefined) {
      customClearTimeout(graceTimeoutId);
    }

    try {
      lifecycle.markStopped();
    } catch {
      // Ignore state transition error if already stopped or failed
    }

    logger.info({
      event: LOG_EVENTS.shutdownCompleted,
      message: "Graceful shutdown completed.",
    });

    await flushLogger();
  }

  return {
    shutdown(reason: ShutdownReason, exitCode: number): Promise<void> {
      if (!shutdownPromise) {
        shutdownPromise = executeShutdown(reason, exitCode);
      } else {
        logger.warn({
          event: LOG_EVENTS.shutdownStarted,
          reason,
          message: "Shutdown already in progress. Ignoring additional request.",
        });
      }
      return shutdownPromise;
    },
    isShuttingDown(): boolean {
      return shutdownPromise !== null;
    },
  };
}
