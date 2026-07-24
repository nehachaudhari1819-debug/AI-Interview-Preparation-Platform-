import type { ApplicationConfig } from "../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { normalizeSupabaseError } from "../../integrations/supabase/supabase-error-normalizer.js";
import type { Json } from "../database.types.js";

export type IdempotencyRecordStatus = "processing" | "completed" | "failed" | "conflict";

export type AcquireIdempotencyResult = {
  status: IdempotencyRecordStatus;
  responseStatus?: number | undefined;
  responseBody?: unknown | undefined;
};

export type AcquireIdempotencyInput = {
  userId: string;
  idempotencyKey: string;
  operation: string;
  requestHash: string;
};

export type CompleteIdempotencyInput = {
  userId: string;
  idempotencyKey: string;
  operation: string;
  responseStatus: number;
  responseBody: unknown;
};

export interface IdempotencyRepository {
  /**
   * Attempts to reserve an idempotency key.
   * If successful, returns status 'processing'.
   * If already exists with same hash, returns existing status and payload.
   * If already exists with different hash, returns status 'conflict'.
   */
  tryAcquire(input: AcquireIdempotencyInput): Promise<AcquireIdempotencyResult>;

  /**
   * Completes the idempotency record with the final response.
   */
  complete(input: CompleteIdempotencyInput): Promise<void>;
}

export function createSupabaseIdempotencyRepository(
  config: Readonly<ApplicationConfig>,
): IdempotencyRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async tryAcquire(input: AcquireIdempotencyInput): Promise<AcquireIdempotencyResult> {
      try {
        const client = getClient();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        // 1. Attempt to insert new record
        const { error: insertError } = await client.from("idempotency_records").insert({
          user_id: input.userId,
          idempotency_key: input.idempotencyKey,
          operation: input.operation,
          request_hash: input.requestHash,
          status: "processing",
          expires_at: expiresAt,
        });

        if (!insertError) {
          return { status: "processing" };
        }

        // 2. If it's not a unique constraint violation, throw
        if (insertError.code !== "23505") {
          throw normalizeSupabaseError(insertError, { operation: "insert_idempotency" });
        }

        // 3. Conflict occurred, fetch the existing record
        const { data: existing, error: fetchError } = await client
          .from("idempotency_records")
          .select("status, request_hash, response_status, response_body")
          .eq("user_id", input.userId)
          .eq("idempotency_key", input.idempotencyKey)
          .eq("operation", input.operation)
          .maybeSingle();

        if (fetchError || !existing) {
          throw new PersistenceError(
            PersistenceErrorCode.OPERATION_FAILED,
            "Failed to fetch conflicting idempotency record.",
          );
        }

        // 4. Validate request hash matches
        if (existing.request_hash !== input.requestHash) {
          return { status: "conflict" };
        }

        return {
          status: existing.status as IdempotencyRecordStatus,
          responseStatus: existing.response_status ?? undefined,
          responseBody: existing.response_body ?? undefined,
        };
      } catch (err: unknown) {
        if (PersistenceError.is(err)) throw err;
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to acquire idempotency lock.",
        );
      }
    },

    async complete(input: CompleteIdempotencyInput): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client
          .from("idempotency_records")
          .update({
            status: "completed",
            response_status: input.responseStatus,
            response_body: input.responseBody as Json,
          })
          .eq("user_id", input.userId)
          .eq("idempotency_key", input.idempotencyKey)
          .eq("operation", input.operation)
          .eq("status", "processing"); // Ensure we only complete if processing

        if (error) {
          throw normalizeSupabaseError(error, { operation: "complete_idempotency" });
        }
      } catch (err: unknown) {
        if (PersistenceError.is(err)) throw err;
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to complete idempotency record.",
        );
      }
    },
  };
}
