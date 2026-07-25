/**
 * P3.7 — Generic Audit Middleware
 *
 * Logs OPTIONAL operational audit events after a successful HTTP response.
 *
 * IMPORTANT: This middleware uses a fire-and-forget pattern (res.on("finish"))
 * and is NOT suitable as a durability mechanism for mandatory audit events.
 *
 * PROFILE_UPDATED durability is provided by the PostgreSQL trigger
 * `audit_user_profile_update_trigger` (migration 14), which executes in the
 * same transaction as the profile update and fails the mutation if the audit
 * insert fails. Do NOT register this middleware on PATCH /users/me for
 * PROFILE_UPDATED — doing so would produce a duplicate audit event.
 *
 * Use this middleware only for optional, best-effort operational logging where
 * an explicit failure policy (fire-and-forget) is acceptable and documented.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { createSupabaseAuditRepository } from "../persistence/system/audit.repository.js";
import { getRequestLogger, LOG_EVENTS } from "../observability/logging/index.js";

export type AuditOptions = {
  action: string;
  resourceType: string;
};

export function createAuditMiddleware(
  config: Readonly<ApplicationConfig>,
  options: AuditOptions,
  repoFactory: typeof createSupabaseAuditRepository = createSupabaseAuditRepository,
): RequestHandler {
  const auditRepo = repoFactory(config);

  return (req: Request, res: Response, next: NextFunction) => {
    // Log the audit event only after the response has successfully finished.
    // This is a fire-and-forget pattern — failure does NOT roll back the request.
    res.on("finish", () => {
      // Only audit successful mutations (2xx).
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const actorUserId =
          req.context.authentication.state === "authenticated"
            ? req.context.authentication.principal.userId
            : null;

        const metadata = (res.locals.auditMetadata as Record<string, unknown> | undefined) ?? null;
        const resourceId =
          (res.locals.auditResourceId as string | undefined) ?? actorUserId ?? null;

        // Asynchronously log to the database without blocking the response.
        // Failure is logged but does NOT affect the HTTP response already sent.
        auditRepo
          .logEvent({
            action: options.action,
            resourceType: options.resourceType,
            actorUserId,
            resourceId,
            metadata,
            requestId: req.context.requestId,
            ipAddress: req.ip ?? null,
            userAgent: req.headers["user-agent"] ?? null,
          })
          .catch((error: unknown) => {
            const logger = getRequestLogger();
            logger?.error(
              {
                event: LOG_EVENTS.systemAuditPersistenceFailed,
                error,
                action: options.action,
              },
              "Failed to write optional operational audit log entry.",
            );
          });
      }
    });

    next();
  };
}
