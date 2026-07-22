export const LOG_EVENTS = {
  applicationStarting: "application.starting",
  applicationReady: "application.ready",
  applicationStartupFailed: "application.startup_failed",
  shutdownStarted: "application.shutdown.started",
  shutdownCompleted: "application.shutdown.completed",
  shutdownForced: "application.shutdown.forced",
  processUnhandledRejection: "process.unhandled_rejection",
  processUncaughtException: "process.uncaught_exception",
  httpRequestCompleted: "http.request.completed",
  httpRequestAborted: "http.request.aborted",
  httpRequestError: "http.request.error",
  readinessFailed: "health.readiness.failed",
} as const;
