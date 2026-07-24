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
): RequestHandler {
  const auditRepo = createSupabaseAuditRepository(config);

  return (req: Request, res: Response, next: NextFunction) => {
    // We want to log the audit event only after the response has successfully finished.
    res.on("finish", () => {
      // Typically, we only audit successful mutations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Extract actor from authenticated context
        const actorUserId =
          req.context?.authentication?.state === "authenticated"
            ? req.context.authentication.principal.userId
            : null;

        const metadata = res.locals.auditMetadata ?? null;
        const resourceId = res.locals.auditResourceId ?? actorUserId ?? null; // default to actor if self-action

        // Asynchronously log to the database without blocking the response
        auditRepo
          .logEvent({
            action: options.action,
            resourceType: options.resourceType,
            actorUserId,
            resourceId,
            metadata,
            requestId: req.context?.requestId,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
          })
          .catch((error) => {
            // Failed to write audit log - record error in application logs
            const logger = getRequestLogger(req);
            logger.error(
              {
                event: LOG_EVENTS.systemAuditFailed,
                error,
                auditAction: options.action,
              },
              "Failed to persist audit log",
            );
          });
      }
    });

    next();
  };
}
