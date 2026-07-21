import type { Request } from "express";
import { MAX_BEARER_TOKEN_LENGTH } from "./auth.constants.js";
import { InvalidAuthorizationHeaderError } from "../errors/invalid-authorization-header.error.js";

export type BearerTokenExtractionResult =
  | {
      status: "missing";
    }
  | {
      status: "present";
      token: string;
    };

/**
 * Extracts a Bearer token from the given authorization header.
 * Rejects ambiguous, malformed, or excessively large tokens.
 */
export function extractBearerToken(
  authorizationHeader: string | undefined,
): BearerTokenExtractionResult {
  if (!authorizationHeader) {
    return { status: "missing" };
  }

  // Reject header values with control characters (excluding tab \x09)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0A-\x1F\x7F]/.test(authorizationHeader)) {
    return { status: "missing" };
  }

  // Trim harmless surrounding whitespace
  const trimmed = authorizationHeader.trim();
  if (!trimmed) {
    return { status: "missing" };
  }

  // Fast prefix check, case insensitive for "bearer "
  if (!/^bearer\s/i.test(trimmed)) {
    return { status: "missing" };
  }

  // Extract the scheme and token segments
  const parts = trimmed.split(/\s+/);

  // Reject multiple segments (e.g. Bearer token1 token2) or empty token (e.g. Bearer)
  if (parts.length !== 2) {
    return { status: "missing" };
  }

  const scheme = parts[0];
  const token = parts[1];

  // Extra safety to ensure the scheme is exactly "bearer" (case insensitive)
  if (scheme?.toLowerCase() !== "bearer") {
    return { status: "missing" };
  }

  if (!token) {
    return { status: "missing" };
  }

  if (token.length > MAX_BEARER_TOKEN_LENGTH) {
    return { status: "missing" };
  }

  // Reject tokens that have commas (e.g., comma separated credentials)
  if (token.includes(",")) {
    return { status: "missing" };
  }

  return { status: "present", token };
}

/**
 * Reads a single Authorization header from the request.
 * Defensively rejects multiple Authorization headers to prevent header smuggling.
 */
export function readSingleAuthorizationHeader(request: Request): string | undefined {
  let count = 0;
  let headerValue: string | undefined = undefined;

  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    const name = request.rawHeaders[i];
    if (name && name.toLowerCase() === "authorization") {
      count++;
      headerValue = request.rawHeaders[i + 1];
    }
  }

  if (count === 0) {
    return undefined;
  }

  if (count > 1) {
    // If multiple Authorization headers exist, we fail closed by throwing or returning undefined.
    // The requirement states: "Reject more than one Authorization header."
    // We will return undefined so the caller throws InvalidAuthorizationHeaderError.
    // Alternatively, returning a symbol to indicate ambiguity, but undefined is safer.
    // Actually, if we return undefined, it might look like 'missing' instead of 'invalid'.
    // Let's throw a specific error, OR the caller can handle multiple headers as invalid.
    // Wait, requirement: "Return undefined when none exists."
    // And "Duplicate Authorization headers must produce: 401 INVALID_AUTHORIZATION_HEADER".
    // Since readSingleAuthorizationHeader returns `string | undefined`, it's better to throw here if we have multiples.
    // BUT the requirement in STEP 7 says:
    // 3. Reject more than one Authorization header.
    // 4. Return the single normalized header when one exists.
    // 5. Return `undefined` when none exists.
    // It's probably best to throw a dedicated error here that middleware catches, or return undefined?
    // If we throw here, we must throw InvalidAuthorizationHeaderError. Since we don't have it yet,
    // let's just throw an Error for now and we will replace it or we will throw the exact error once implemented.
    // Wait, returning a symbol or a special object isn't in the signature.
    // The signature is `export function readSingleAuthorizationHeader(request: Request): string | undefined;`
    // Therefore, it MUST throw to reject, because returning undefined means "missing".
    throw new InvalidAuthorizationHeaderError();
  }

  return headerValue;
}
