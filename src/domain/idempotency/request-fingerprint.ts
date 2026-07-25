/**
 * P3.7 — Request Fingerprint Service
 *
 * Produces a canonical, deterministic SHA-256 fingerprint for an
 * idempotency-scoped API request. The same logical request must always
 * produce the same fingerprint regardless of key ordering in the body.
 *
 * Fingerprint components:
 *   - API version (e.g. "v1")
 *   - HTTP method (normalized to uppercase)
 *   - Route pattern (normalized, e.g. "/users/me" — no dynamic segments)
 *   - Operation identifier (stable string per endpoint)
 *   - Canonically serialized body (sorted keys, no whitespace)
 *
 * Explicitly excluded:
 *   - Authorization header
 *   - Idempotency-Key header
 *   - Refresh cookie
 *   - Request ID
 *   - IP address
 *   - User-agent
 *   - Raw access/refresh tokens
 */

import crypto from "node:crypto";

export type RequestFingerprintInput = {
  /** Stable API version prefix, e.g. "v1". */
  apiVersion: string;
  /** HTTP method, normalized to uppercase. */
  method: string;
  /** Normalized route pattern (no dynamic segments), e.g. "/users/me". */
  routePattern: string;
  /** Stable operation identifier, e.g. "update_profile". */
  operation: string;
  /**
   * Validated request body. Will be canonically serialized with sorted keys.
   * Pass only the validated, normalized body — not the raw Express body.
   */
  body: unknown;
};

/**
 * Recursively sorts object keys for canonical JSON serialization.
 * Arrays are preserved in order. Primitives and null are returned as-is.
 */
function sortObjectKeys(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortObjectKeys((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Produces a hex-encoded SHA-256 fingerprint for the given request components.
 *
 * The fingerprint is safe to log as a correlation identifier (it is a hash,
 * not the raw key), but should only be logged at the minimum required length
 * to avoid unnecessary storage.
 */
export function generateRequestFingerprint(input: RequestFingerprintInput): string {
  const canonical = JSON.stringify({
    apiVersion: input.apiVersion,
    method: input.method.toUpperCase(),
    routePattern: input.routePattern,
    operation: input.operation,
    body: sortObjectKeys(input.body),
  });

  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}
