import type { ApplicationConfig } from "../../config/app-config.js";
import { createPrivilegedSupabaseClient } from "../../integrations/supabase/admin/create-privileged-supabase-client.js";
import { PersistenceError, PersistenceErrorCode } from "../persistence-error.js";
import { normalizeSupabaseError } from "../../integrations/supabase/supabase-error-normalizer.js";
import type { Json } from "../database.types.js";

export type AuditLogEntry = {
  actorUserId?: string | null;
  actorType?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export interface AuditRepository {
  /**
   * Appends an audit log entry to the database asynchronously.
   * Throws PersistenceError if the operation fails.
   */
  logEvent(entry: AuditLogEntry): Promise<void>;
}

export function createSupabaseAuditRepository(
  config: Readonly<ApplicationConfig>,
): AuditRepository {
  const getClient = () => createPrivilegedSupabaseClient({ config });

  return {
    async logEvent(entry: AuditLogEntry): Promise<void> {
      try {
        const client = getClient();
        const { error } = await client.from("audit_logs").insert({
          action: entry.action,
          resource_type: entry.resourceType,
          actor_user_id: entry.actorUserId ?? null,
          actor_type: entry.actorType ?? "user",
          resource_id: entry.resourceId ?? null,
          metadata: (entry.metadata as Json) ?? null,
          request_id: entry.requestId ?? null,
          ip_address: entry.ipAddress ?? null,
          user_agent: entry.userAgent ?? null,
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
          "Failed to insert audit log entry.",
        );
      }
    },
  };
}
