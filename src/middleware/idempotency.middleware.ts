import type { Request, Response, NextFunction, RequestHandler } from "express";
import crypto from "node:crypto";
import { AppError } from "../errors/app-error.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import type { ApplicationConfig } from "../config/app-config.js";
import { createSupabaseIdempotencyRepository } from "../persistence/system/idempotency.repository.js";
import { getRequestLogger, LOG_EVENTS } from "../observability/logging/index.js";

// Note: In P3.5 this schema was used in the controller.
// We keep the rules the same for the generalized middleware.
const isValidIdempotencyKey = (key: string): boolean => {
  if (!key || typeof key !== "string") return false;
  if (key.length === 0 || key.length > 255) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(key)) return false;
  return true;
};

export type IdempotencyOptions = {
  operation: string;
};

export function createIdempotencyMiddleware(
  config: Readonly<ApplicationConfig>,
  options: IdempotencyOptions,
  repoFactory: typeof createSupabaseIdempotencyRepository = createSupabaseIdempotencyRepository,
): RequestHandler {
  const repo = repoFactory(config);

  return (req: Request, res: Response, next: NextFunction) => {
    // Only apply to authenticated requests to prevent arbitrary cache filling
    if (req.context.authentication.state !== "authenticated") {
      next(
        new AppError({
          statusCode: HTTP_STATUS.UNAUTHORIZED,
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication is required for idempotency.",
        }),
      );
      return;
    }
    const userId = req.context.authentication.principal.userId;

    // 1. Validate header
    const rawKey = req.headers["idempotency-key"];
    if (!rawKey) {
      next(
        new AppError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "Idempotency-Key header is required.",
        }),
      );
      return;
    }

    if (Array.isArray(rawKey)) {
      next(
        new AppError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "IDEMPOTENCY_KEY_INVALID",
          message: "Duplicate Idempotency-Key headers are not allowed.",
        }),
      );
      return;
    }

    if (!isValidIdempotencyKey(rawKey)) {
      next(
        new AppError({
          statusCode: HTTP_STATUS.BAD_REQUEST,
          code: "IDEMPOTENCY_KEY_INVALID",
          message: "Invalid Idempotency-Key header format.",
        }),
      );
      return;
    }
    const idempotencyKey = rawKey;

    // 2. Hash request payload
    // A simple hash of the body, URL, and operation
    const hash = crypto.createHash("sha256");
    hash.update(options.operation);
    hash.update(req.originalUrl);
    if (req.body && typeof req.body === "object") {
      hash.update(JSON.stringify(req.body));
    }
    const requestHash = hash.digest("hex");

    // 3. Attempt to acquire lock
    repo
      .tryAcquire({
        userId,
        idempotencyKey,
        operation: options.operation,
        requestHash,
      })
      .then((result) => {
        if (result.status === "conflict") {
          next(
            new AppError({
              statusCode: HTTP_STATUS.CONFLICT,
              code: "IDEMPOTENCY_CONFLICT",
              message: "Idempotency key already exists with different request parameters.",
            }),
          );
          return;
        }

        if (result.status === "completed") {
          // Return cached response
          if (result.responseStatus) res.status(result.responseStatus);

          let bodyToSend = result.responseBody;
          if (typeof bodyToSend === "string") {
            try {
              bodyToSend = JSON.parse(bodyToSend);
            } catch {
              /* ignore */
            }
          }
          res.json(bodyToSend);
          return;
          return;
        }

        if (result.status === "processing") {
          // 4. Lock acquired, intercept response to cache on finish

          const originalJson = res.json;
          let responseBodyForIdempotency: unknown = undefined;

          // Override res.json to capture body
          res.json = function (body) {
            responseBodyForIdempotency = body;
            return originalJson.call(this, body);
          };

          res.on("finish", () => {
            // Only cache successful responses (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
              repo
                .complete({
                  userId,
                  idempotencyKey,
                  operation: options.operation,
                  responseStatus: res.statusCode,
                  responseBody: responseBodyForIdempotency,
                })
                .catch((error: unknown) => {
                  const logger = getRequestLogger();
                  logger?.error(
                    { event: LOG_EVENTS.systemAuditFailed, error, idempotencyKey }, // Reusing event or create a new one? Better use a generic error
                    "Failed to complete idempotency record.",
                  );
                });
            }
          });

          next();
          return;
        }

        // Handle other statuses like failed
        next(
          new AppError({
            statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
            code: "SERVICE_UNAVAILABLE",
            message: "Idempotency lock state invalid or failed. Please try again later.",
          }),
        );
      })
      .catch((error: unknown) => {
        next(error);
      });
  };
}
