/**
 * P3.7 — Idempotency Domain Repository Interface
 *
 * Technology-independent contract for the idempotency persistence layer.
 * No Express, Supabase, or PostgreSQL dependencies.
 *
 * Adapters (e.g. SupabaseIdempotencyRepository) implement this interface.
 */

import type {
  IdempotencyAcquireResult,
  AcquireIdempotencyInput,
  CompleteIdempotencyInput,
  FailIdempotencyInput,
} from "./idempotency.types.js";

export interface IdempotencyDomainRepository {
  /**
   * Atomically acquires (or inspects) an idempotency record.
   *
   * Returns a typed discriminated union covering all acquisition outcomes.
   * The caller must never inspect raw database rows directly.
   */
  acquire(input: AcquireIdempotencyInput): Promise<IdempotencyAcquireResult>;

  /**
   * Completes a processing record with the final response payload.
   *
   * Requires the exact lease token issued during acquisition.
   * Returns true if exactly one row was updated, false otherwise.
   *
   * MUST be called and awaited before sending a successful HTTP response.
   * Must never be called from res.on("finish") or a detached promise.
   */
  complete(input: CompleteIdempotencyInput): Promise<boolean>;

  /**
   * Marks a processing record as failed, releasing the lease.
   *
   * Requires the exact lease token issued during acquisition.
   * Returns true if exactly one row was updated, false otherwise.
   *
   * Allows a future retry to re-acquire the key.
   */
  fail(input: FailIdempotencyInput): Promise<boolean>;
}
