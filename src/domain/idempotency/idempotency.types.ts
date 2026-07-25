/**
 * P3.7 — Idempotency Domain Types
 *
 * Technology-independent types for the idempotency subsystem.
 * No Express, Supabase, or PostgreSQL dependencies.
 *
 * Persistent record statuses (stored in DB): processing | completed | failed
 * Domain acquisition results (returned to callers): acquired | in_progress | replay | conflict | retryable_failed | unavailable
 */

// ---------------------------------------------------------------------------
// Persistent status (as stored in the database)
// ---------------------------------------------------------------------------
export type IdempotencyRecordStatus = "processing" | "completed" | "failed";

// ---------------------------------------------------------------------------
// Domain acquisition result discriminated union
// ---------------------------------------------------------------------------

/** New lease was granted. Caller must execute the operation. */
export type IdempotencyAcquired = {
  readonly status: "acquired";
  readonly recordId: string;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string;
};

/** A valid processing lease exists for this key. Client should retry later. */
export type IdempotencyInProgress = {
  readonly status: "in_progress";
};

/** Key was completed with the same request hash. Return cached response. */
export type IdempotencyReplay = {
  readonly status: "replay";
  readonly responseStatus: number;
  readonly responseBody: unknown;
};

/** Key exists with a different request hash. Operation is permanently rejected. */
export type IdempotencyConflict = {
  readonly status: "conflict";
};

/** Temporary failure acquiring the lease; caller may safely retry. */
export type IdempotencyRetryableFailed = {
  readonly status: "retryable_failed";
};

/** Service is unavailable; caller should surface a 503 and not retry immediately. */
export type IdempotencyUnavailable = {
  readonly status: "unavailable";
};

export type IdempotencyAcquireResult =
  | IdempotencyAcquired
  | IdempotencyInProgress
  | IdempotencyReplay
  | IdempotencyConflict
  | IdempotencyRetryableFailed
  | IdempotencyUnavailable;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export type AcquireIdempotencyInput = {
  /** Authenticated user who owns the operation. */
  userId: string;
  /** Stable operation identifier, e.g. "update_profile". */
  operation: string;
  /** Client-supplied idempotency key (already validated). */
  idempotencyKey: string;
  /** Canonical SHA-256 fingerprint of the request. */
  requestHash: string;
  /** Lease duration in seconds. */
  leaseDurationSec: number;
};

export type CompleteIdempotencyInput = {
  recordId: string;
  leaseToken: string;
  responseStatus: number;
  responseBody: unknown;
};

export type FailIdempotencyInput = {
  recordId: string;
  leaseToken: string;
};

// ---------------------------------------------------------------------------
// Execution context (attached to request after successful acquisition)
// ---------------------------------------------------------------------------

export type IdempotencyLeaseContext = {
  readonly recordId: string;
  readonly leaseToken: string;
};
