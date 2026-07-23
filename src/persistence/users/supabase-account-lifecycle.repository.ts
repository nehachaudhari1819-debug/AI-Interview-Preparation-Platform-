import type { ApplicationConfig } from "../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { normalizeSupabaseError } from "../../integrations/supabase/supabase-error-normalizer.js";
import type {
  AccountLifecycleRepository,
  AccountLifecycleResult,
  AtomicSoftDeleteInput,
  AtomicSoftDeleteResult,
} from "./account-lifecycle.repository.js";

export function createSupabaseAccountLifecycleRepository(
  config: Readonly<ApplicationConfig>,
): AccountLifecycleRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async softDeleteOwnAccount(userId: string): Promise<AccountLifecycleResult> {
      try {
        const client = getClient();

        const { data, error } = await client
          .from("users")
          .update({
            account_status: "deleted",
            deleted_at: new Date().toISOString(),
          })
          .eq("id", userId)
          .select("account_status, deleted_at")
          .maybeSingle();

        if (error) {
          throw normalizeSupabaseError(error, { operation: "soft_delete" });
        }

        if (!data) {
          throw new PersistenceError(
            PersistenceErrorCode.RECORD_NOT_FOUND,
            "User profile not found.",
          );
        }

        return {
          success: true,
          account: {
            status: "deleted",
          },
        };
      } catch (err: unknown) {
        if (PersistenceError.is(err)) {
          throw err;
        }
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to execute soft deletion.",
        );
      }
    },

    async prepareSoftDelete(input: AtomicSoftDeleteInput): Promise<AtomicSoftDeleteResult> {
      try {
        const client = getClient();
        const { data, error } = await client.rpc("prepare_soft_delete_account", {
          p_user_id: input.userId,
          p_idempotency_key: input.idempotencyKey,
          p_request_id: input.requestId,
          p_request_hash: input.requestHash,
          p_operation: input.operation,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "prepare_soft_delete" });
        }

        if (!data) {
          throw new PersistenceError(
            PersistenceErrorCode.OPERATION_FAILED,
            "RPC prepare_soft_delete_account returned null.",
          );
        }

        // Map snake_case from DB to camelCase for TS
        type RpcResponse = {
          status: "processing" | "completed" | "success" | "failed" | "conflict";
          response_status?: number;
          response_body?: unknown;
          reason?: string;
        };
        const r = data as unknown as RpcResponse;
        return {
          status: r.status,
          ...(r.response_status ? { responseStatus: r.response_status } : {}),
          ...(r.response_body ? { responseBody: r.response_body } : {}),
          ...(r.reason ? { reason: r.reason } : {}),
        };
      } catch (err: unknown) {
        if (PersistenceError.is(err)) {
          throw err;
        }
        console.error("RPC prepare soft deletion failed:", err);
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to execute prepare soft deletion.",
        );
      }
    },

    async finalizeSoftDelete(
      input: Omit<AtomicSoftDeleteInput, "requestId" | "requestHash">,
    ): Promise<AtomicSoftDeleteResult> {
      try {
        const client = getClient();
        const { data, error } = await client.rpc("finalize_soft_delete_account", {
          p_user_id: input.userId,
          p_idempotency_key: input.idempotencyKey,
          p_operation: input.operation,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "finalize_soft_delete" });
        }

        if (!data) {
          throw new PersistenceError(
            PersistenceErrorCode.OPERATION_FAILED,
            "RPC finalize_soft_delete_account returned null.",
          );
        }

        type RpcResponse = {
          status: "processing" | "completed" | "success" | "failed" | "conflict";
          response_status?: number;
          response_body?: unknown;
          reason?: string;
        };
        const r = data as unknown as RpcResponse;
        return {
          status: r.status,
          ...(r.response_status ? { responseStatus: r.response_status } : {}),
          ...(r.response_body ? { responseBody: r.response_body } : {}),
          ...(r.reason ? { reason: r.reason } : {}),
        };
      } catch (err: unknown) {
        if (PersistenceError.is(err)) {
          throw err;
        }
        console.error("RPC finalize soft deletion failed:", err);
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to execute finalize soft deletion.",
        );
      }
    },
  };
}
