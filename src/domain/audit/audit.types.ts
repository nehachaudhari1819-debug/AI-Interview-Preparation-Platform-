/**
 * P3.7 — Audit Domain Types
 *
 * Technology-independent types for the audit subsystem.
 * No Express, Supabase, or PostgreSQL dependencies.
 */

export type AuditActorType = "user" | "system" | "service";

export type AuditLogEntry = {
  /** Authenticated user who performed the action, or null for system events. */
  actorUserId: string | null;
  actorType: AuditActorType;
  /** Approved event identifier, e.g. PROFILE_UPDATED, ACCOUNT_DEACTIVATED. */
  action: string;
  /** Category of the affected resource, e.g. "user_profile". */
  resourceType: string;
  /** Identifier of the affected resource, e.g. the user's UUID. */
  resourceId: string | null;
  /**
   * Safe structured metadata. Must never contain profile values, credentials,
   * tokens, raw idempotency keys, or PII. Field names only.
   */
  metadata: Record<string, unknown> | null;
  /** Correlation ID from the originating HTTP request, if available. */
  requestId: string | null;
  /** Client IP address. */
  ipAddress: string | null;
  /** Client user-agent string. */
  userAgent: string | null;
};

export interface AuditRepository {
  /**
   * Appends an audit log entry.
   *
   * Note: For PROFILE_UPDATED, durability is guaranteed by the PostgreSQL
   * trigger `audit_user_profile_update_trigger` that executes in the same
   * transaction as the profile mutation. This repository is used only for
   * optional operational events where fire-and-forget failure policy is
   * explicitly accepted.
   */
  logEvent(entry: AuditLogEntry): Promise<void>;
}
