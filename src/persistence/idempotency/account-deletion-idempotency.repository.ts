import type { ApplicationConfig } from "../../config/app-config.js";
import type { Json } from "../database.types.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";

export type IdempotencyRecordStatus = "processing" | "completed" | "failed";

export type ReserveIdempotencyInput = {
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

export type ReservedIdempotencyResult =
  | { status: "processing" }
  | { status: "completed"; responseStatus: number; responseBody: unknown }
  | { status: "failed" }
  | { status: "conflict" }; // Means a record exists for this user/key but with different operation/hash

export interface AccountDeletionIdempotencyRepository {
  /**
   * Attempts to reserve the idempotency key for the user and operation.
   * If it already exists, returns the existing record's state.
   */
  reserveOperation(input: ReserveIdempotencyInput): Promise<ReservedIdempotencyResult>;

  /**
   * Marks the operation as completed with a safe response payload.
   */
  completeOperation(input: CompleteIdempotencyInput): Promise<void>;
}

export function createSupabaseAccountDeletionIdempotencyRepository(
  config: Readonly<ApplicationConfig>,
): AccountDeletionIdempotencyRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async reserveOperation(input: ReserveIdempotencyInput): Promise<ReservedIdempotencyResult> {
      try {
        const client = getClient();

        // Expiration in 24 hours
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { data, error } = await client
          .from("idempotency_records")
          .insert({
            user_id: input.userId,
            idempotency_key: input.idempotencyKey,
            operation: input.operation,
            request_hash: input.requestHash,
            status: "processing",
            expires_at: expiresAt,
          })
          .select("status, response_status, response_body, operation, request_hash")
          .maybeSingle();

        if (!error && data) {
          return { status: "processing" };
        }

        // 23505 is PostgreSQL unique violation code
        if (error && error.code === "23505") {
          // Fetch the existing record to see its state
          const { data: existingData, error: fetchError } = await client
            .from("idempotency_records")
            .select("status, response_status, response_body, operation, request_hash")
            .eq("user_id", input.userId)
            .eq("operation", input.operation)
            .eq("idempotency_key", input.idempotencyKey)
            .maybeSingle();

          if (fetchError) throw fetchError;

          if (existingData) {
            // Check for fingerprint mismatch (operation/hash)
            if (
              existingData.operation !== input.operation ||
              existingData.request_hash !== input.requestHash
            ) {
              return { status: "conflict" };
            }

            if (existingData.status === "completed") {
              return {
                status: "completed",
                responseStatus: existingData.response_status ?? 200,
                responseBody: existingData.response_body,
              };
            } else if (existingData.status === "failed") {
              return { status: "failed" };
            }

            return { status: "processing" };
          }
        }

        if (error) {
          throw error;
        }

        throw new Error("Unexpected state in reserveOperation");
      } catch {
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to reserve idempotency record.",
        );
      }
    },

    async completeOperation(input: CompleteIdempotencyInput): Promise<void> {
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
          .eq("operation", input.operation)
          .eq("idempotency_key", input.idempotencyKey);

        if (error) {
          throw error;
        }
      } catch {
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to complete idempotency record.",
        );
      }
    },
  };
}
