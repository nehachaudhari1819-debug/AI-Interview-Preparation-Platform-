/**
 * P3.7 — Idempotency Key Parser
 *
 * Pure validation logic for Idempotency-Key header values.
 * No Express, Supabase, or database dependencies.
 */

/**
 * Maximum allowed byte length for an idempotency key.
 * Matches the P3.5 approved contract (255 characters).
 */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 255;

export type IdempotencyKeyParseSuccess = {
  readonly ok: true;
  readonly key: string;
};

export type IdempotencyKeyParseFailure = {
  readonly ok: false;
  readonly reason: "missing" | "duplicate_header" | "empty" | "control_characters" | "too_long";
};

export type IdempotencyKeyParseResult = IdempotencyKeyParseSuccess | IdempotencyKeyParseFailure;

/**
 * Parses and validates an Idempotency-Key header value.
 *
 * Accepts the raw value from `req.headers["idempotency-key"]`, which may
 * be a string, string[], or undefined.
 *
 * Rules (per P3.5 and P3.7 approved contracts):
 * - Exactly one header value required.
 * - Empty value rejected.
 * - Control characters (0x00–0x1F, 0x7F) rejected.
 * - Maximum length: 255 characters.
 * - Raw key is never stored or returned by this module.
 */
export function parseIdempotencyKey(raw: string | string[] | undefined): IdempotencyKeyParseResult {
  if (raw === undefined || (raw as unknown) === null) {
    return { ok: false, reason: "missing" };
  }

  if (Array.isArray(raw)) {
    return { ok: false, reason: "duplicate_header" };
  }

  if (raw.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (raw.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }

  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(raw)) {
    return { ok: false, reason: "control_characters" };
  }

  return { ok: true, key: raw };
}
