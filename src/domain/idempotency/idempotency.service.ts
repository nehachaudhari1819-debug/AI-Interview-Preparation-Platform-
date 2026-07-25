/**
 * P3.7 — Idempotency Domain Service
 *
 * Pure orchestration over the IdempotencyDomainRepository.
 * No Express, Supabase, or PostgreSQL dependencies.
 *
 * Responsibilities:
 * - Validate parsed key and fingerprint inputs.
 * - Delegate to the repository for all persistence operations.
 * - Map repository outcomes to typed domain results.
 * - Log safe correlation identifiers only (never raw keys or hashes).
 *
 * This service does NOT interact with HTTP request/response directly.
 * The Express adapter (idempotency.middleware.ts) is the thin HTTP layer.
 */

import type { IdempotencyDomainRepository } from "./idempotency.repository.js";
import type {
  IdempotencyAcquireResult,
  AcquireIdempotencyInput,
  CompleteIdempotencyInput,
  FailIdempotencyInput,
} from "./idempotency.types.js";

export class IdempotencyService {
  public constructor(private readonly repository: IdempotencyDomainRepository) {}

  /**
   * Acquires (or inspects) an idempotency record.
   *
   * Returns a typed result that the Express adapter uses to route the request:
   * - acquired    → execute business logic
   * - replay      → return cached response
   * - in_progress → return 409 with retry advice
   * - conflict    → return 409 permanent conflict
   * - retryable_failed / unavailable → return 503
   */
  public async acquire(input: AcquireIdempotencyInput): Promise<IdempotencyAcquireResult> {
    return this.repository.acquire(input);
  }

  /**
   * Completes a processing record with the final response payload.
   *
   * MUST be awaited before the HTTP response is sent to the client.
   * Returns true if exactly one record was completed; false if the lease was
   * lost (e.g. reclaimed by a stale-recovery process).
   */
  public async complete(input: CompleteIdempotencyInput): Promise<boolean> {
    return this.repository.complete(input);
  }

  /**
   * Marks a processing record as failed, releasing the key for future retries.
   *
   * Returns true if exactly one record transitioned; false if the lease was
   * already lost.
   */
  public async fail(input: FailIdempotencyInput): Promise<boolean> {
    return this.repository.fail(input);
  }
}

export function createIdempotencyService(
  repository: IdempotencyDomainRepository,
): IdempotencyService {
  return new IdempotencyService(repository);
}
