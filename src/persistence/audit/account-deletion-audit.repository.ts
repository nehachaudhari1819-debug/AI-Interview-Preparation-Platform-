import type { ApplicationConfig } from "../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { normalizeSupabaseError } from "../../integrations/supabase/supabase-error-normalizer.js";

export type WriteAccountDeletionAuditInput = {
  actorUserId: string;
  requestId: string;
  idempotencyKeyDigest?: string;
  operationVersion?: string;
};

export interface AccountDeletionAuditRepository {
  /**
   * Records an immutable audit log entry for the account deactivation event.
   * Throws a PersistenceError on failure.
   */
  writeDeactivationEvent(input: WriteAccountDeletionAuditInput): Promise<void>;
}

export function createSupabaseAccountDeletionAuditRepository(
  config: Readonly<ApplicationConfig>,
): AccountDeletionAuditRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async writeDeactivationEvent(input: WriteAccountDeletionAuditInput): Promise<void> {
      try {
        const client = getClient();

        const metadata = {
          result: "deleted",
          ...(input.idempotencyKeyDigest
            ? { idempotencyKeyDigest: input.idempotencyKeyDigest }
            : {}),
          ...(input.operationVersion ? { operationVersion: input.operationVersion } : {}),
        };

        const { error } = await client.from("audit_logs").insert({
          actor_user_id: input.actorUserId,
          actor_type: "user",
          action: "ACCOUNT_DEACTIVATED",
          resource_type: "user_profile",
          resource_id: input.actorUserId,
          request_id: input.requestId,
          metadata,
        });

        if (error) {
          throw normalizeSupabaseError(error, { operation: "insert_audit_log" });
        }
      } catch (err: unknown) {
        if (PersistenceError.is(err)) {
          throw err;
        }
        throw new PersistenceError(
          PersistenceErrorCode.OPERATION_FAILED,
          "Failed to write account deactivation audit event.",
        );
      }
    },
  };
}
