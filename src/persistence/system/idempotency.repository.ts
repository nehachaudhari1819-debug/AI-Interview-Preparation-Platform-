import type { ApplicationConfig } from "../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { normalizeSupabaseError } from "../../integrations/supabase/supabase-error-normalizer.js";
import type { Json } from "../database.types.js";

export type IdempotencyRecordStatus = "acquired" | "conflict" | "in_progress" | "replay";

export type AcquireIdempotencyResult = {
  status: IdempotencyRecordStatus;
  recordId?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  responseStatus?: number;
  responseBody?: unknown;
};

export type AcquireIdempotencyInput = {
  userId: string;
  idempotencyKey: string;
  operation: string;
  requestHash: string;
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

export interface IdempotencyRepository {
  /**
   * Attempts to reserve an idempotency key using the DB RPC.
   */
  tryAcquire(
    input: AcquireIdempotencyInput,
    leaseDurationSec?: number,
  ): Promise<AcquireIdempotencyResult>;

  /**
   * Completes the idempotency record with the final response.
   */
  complete(input: CompleteIdempotencyInput): Promise<boolean>;

  /**
   * Fails the idempotency record if the operation crashes or errors out.
   */
  fail(input: FailIdempotencyInput): Promise<boolean>;
}

export function createSupabaseIdempotencyRepository(
  config: Readonly<ApplicationConfig>,
): IdempotencyRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async tryAcquire(
      input: AcquireIdempotencyInput,
      leaseDurationSec = 60,
    ): Promise<AcquireIdempotencyResult> {
      try {
        const client = getClient();

        const { data, error } = await client.rpc("acquire_idempotency_lease", {
          p_user_id: input.userId,
          p_operation: input.operation,
          p_idempotency_key: input.idempotencyKey,
          p_request_hash: input.requestHash,
          p_lease_duration_sec: leaseDurationSec,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "acquire_idempotency_lease" });
        }

        const res = data as unknown as Record<string, unknown>;

        const result: AcquireIdempotencyResult = {
          status: (res.status ?? "conflict") as IdempotencyRecordStatus,
        };

        if (typeof res.record_id === "string") result.recordId = res.record_id;
        if (typeof res.lease_token === "string") result.leaseToken = res.lease_token;
        if (typeof res.lease_expires_at === "string") result.leaseExpiresAt = res.lease_expires_at;
        if (typeof res.response_status === "number") result.responseStatus = res.response_status;
        if (res.response_body !== undefined && res.response_body !== null)
          result.responseBody = res.response_body;

        return result;
      } catch (err: unknown) {
        if (PersistenceError.is(err)) throw err;
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to acquire idempotency lock.",
        );
      }
    },

    async complete(input: CompleteIdempotencyInput): Promise<boolean> {
      try {
        const client = getClient();
        const { data, error } = await client.rpc("complete_idempotency_lease", {
          p_record_id: input.recordId,
          p_lease_token: input.leaseToken,
          p_response_status: input.responseStatus,
          p_response_body: input.responseBody as Json,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "complete_idempotency_lease" });
        }
        return data;
      } catch (err: unknown) {
        if (PersistenceError.is(err)) throw err;
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to complete idempotency record.",
        );
      }
    },

    async fail(input: FailIdempotencyInput): Promise<boolean> {
      try {
        const client = getClient();
        const { data, error } = await client.rpc("fail_idempotency_lease", {
          p_record_id: input.recordId,
          p_lease_token: input.leaseToken,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "fail_idempotency_lease" });
        }
        return data;
      } catch (err: unknown) {
        if (PersistenceError.is(err)) throw err;
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to fail idempotency record.",
        );
      }
    },
  };
}
