import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import type { ApplicationLogger } from "./application-logger.types.js";
import { runWithRequestLogContext } from "./request-log-context.js";
import { createClientIdentity } from "./create-client-identity.js";
import { LOG_EVENTS } from "./logging-events.constants.js";

export type CreateRequestLoggingMiddlewareOptions = {
  config: Readonly<ApplicationConfig>;
  logger: ApplicationLogger;
  clock?: () => number;
};

export function createRequestLoggingMiddleware({
  config,
  logger,
  clock = () => performance.now(),
}: CreateRequestLoggingMiddlewareOptions): RequestHandler {
  return function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
    const requestId = req.id as string | undefined;
    if (!requestId) {
      next();
      return;
    }

    const childLogger = logger.child({ requestId });
    req.log = childLogger;

    const startTime = clock();
    let finished = false;

    const onFinish = () => {
      if (finished) return;
      finished = true;
      cleanup();

      if (!config.observability.logHealthRequests) {
        if (
          (req.path === "/health" || req.path === "/health/ready") &&
          res.statusCode >= 200 &&
          res.statusCode < 400
        ) {
          return;
        }
      }

      const durationMs = Math.round(clock() - startTime);
      const statusCode = res.statusCode;
      let outcome = "success";
      let level: "info" | "warn" | "error" = "info";

      if (statusCode >= 400 && statusCode < 500) {
        outcome = "client_error";
        if (statusCode >= 405) level = "warn";
      } else if (statusCode >= 500) {
        outcome = "server_error";
        level = "error";
      }

      const clientId = createClientIdentity(req.ip, config);
      const securityContext = req.securityContext as { authenticated?: boolean } | undefined;
      const authenticationState = securityContext?.authenticated ? "authenticated" : "anonymous";

      const logData: Record<string, any> = {
        event: LOG_EVENTS.httpRequestCompleted,
        requestId,
        method: req.method,
        path: req.path,
        route: (req.route as { path?: string })?.path ?? "unmatched",
        statusCode,
        durationMs,
        outcome,
        authenticationState,
      };

      if (clientId !== undefined) {
        logData.clientId = clientId;
      }

      childLogger[level](logData);
    };

    const onClose = () => {
      if (finished) return;
      finished = true;
      cleanup();

      const durationMs = Math.round(clock() - startTime);
      const clientId = createClientIdentity(req.ip, config);
      const securityContext = req.securityContext as { authenticated?: boolean } | undefined;
      const authenticationState = securityContext?.authenticated ? "authenticated" : "anonymous";

      const logData: Record<string, any> = {
        event: LOG_EVENTS.httpRequestAborted,
        requestId,
        method: req.method,
        path: req.path,
        route: (req.route as { path?: string })?.path ?? "unmatched",
        statusCode: res.statusCode,
        durationMs,
        outcome: "aborted",
        authenticationState,
      };

      if (clientId !== undefined) {
        logData.clientId = clientId;
      }

      childLogger.warn(logData);
    };

    const cleanup = () => {
      res.removeListener("finish", onFinish);
      res.removeListener("close", onClose);
    };

    res.on("finish", onFinish);
    res.on("close", onClose);

    runWithRequestLogContext({ requestId, logger: childLogger }, next);
  };
}
