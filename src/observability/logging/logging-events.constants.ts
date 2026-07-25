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
  systemAuditFailed: "system.audit_failed",
  // P3.7 — Audit subsystem
  systemAuditPersistenceFailed: "system.audit.persistence_failed",
  // P3.7 — Idempotency subsystem
  systemIdempotencyAcquireFailed: "system.idempotency.acquire_failed",
  systemIdempotencyCompleteFailed: "system.idempotency.complete_failed",
  systemIdempotencyFailTransitionFailed: "system.idempotency.fail_transition_failed",
  securityIdempotencyConflict: "security.idempotency.conflict",
  securityIdempotencyInProgress: "security.idempotency.in_progress",
} as const;
