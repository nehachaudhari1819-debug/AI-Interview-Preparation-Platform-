/**
 * P3.7 — Idempotency Explicit Wrapper
 *
 * Replaces the unsafe Express monkey-patching approach with an explicit
 * awaited execution sequence:
 * acquire lease -> execute typed operation -> obtain response result -> await completion RPC -> send response
 *
 * Status: BACKEND FOUNDATION READY — NO CURRENT GENERIC ROUTE ADOPTION.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { AppError } from "../errors/app-error.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import type { ApplicationConfig } from "../config/app-config.js";
import { createSupabaseIdempotencyRepository } from "../persistence/system/idempotency.repository.js";
import { getRequestLogger, LOG_EVENTS } from "../observability/logging/index.js";
import { parseIdempotencyKey } from "../domain/idempotency/idempotency-key.js";
import { generateRequestFingerprint } from "../domain/idempotency/request-fingerprint.js";
import { createIdempotencyService } from "../domain/idempotency/idempotency.service.js";
import type { IdempotencyDomainRepository } from "../domain/idempotency/idempotency.repository.js";

export type IdempotencyOptions = {
  operation: string;
  apiVersion?: string;
  routePattern: string;
  leaseDurationSec?: number;
};

export type IdempotentHandlerResult<T> = {
  status: number;
  body: T;
};

export type IdempotentHandler<T> = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<IdempotentHandlerResult<T>>;

function createDomainRepositoryAdapter(
  repo: ReturnType<typeof createSupabaseIdempotencyRepository>,
): IdempotencyDomainRepository {
  return {
    async acquire(input) {
      const result = await repo.tryAcquire(
        {
          userId: input.userId,
          idempotencyKey: input.idempotencyKey,
          operation: input.operation,
          requestHash: input.requestHash,
        },
        input.leaseDurationSec,
      );

      switch (result.status) {
        case "acquired":
          return {
            status: "acquired",
            recordId: result.recordId ?? "",
            leaseToken: result.leaseToken ?? "",
            leaseExpiresAt: result.leaseExpiresAt ?? new Date().toISOString(),
          };
        case "in_progress":
          return { status: "in_progress" };
        case "replay":
          return {
            status: "replay",
            responseStatus: result.responseStatus ?? 200,
            responseBody: result.responseBody,
          };
        case "conflict":
          return { status: "conflict" };
        default:
          return { status: "unavailable" };
      }
    },

    async complete(input) {
      return repo.complete({
        recordId: input.recordId,
        leaseToken: input.leaseToken,
        responseStatus: input.responseStatus,
        responseBody: input.responseBody,
      });
    },

    async fail(input) {
      return repo.fail({
        recordId: input.recordId,
        leaseToken: input.leaseToken,
      });
    },
  };
}

export function withIdempotency<T = unknown>(
  config: Readonly<ApplicationConfig>,
  options: IdempotencyOptions,
  handler: IdempotentHandler<T>,
  repoFactory: typeof createSupabaseIdempotencyRepository = createSupabaseIdempotencyRepository,
): RequestHandler {
  const repo = repoFactory(config);
  const domainRepo = createDomainRepositoryAdapter(repo);
  const service = createIdempotencyService(domainRepo);

  const apiVersion = options.apiVersion ?? "v1";
  const leaseDurationSec = options.leaseDurationSec ?? 60;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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

      const parseResult = parseIdempotencyKey(req.headers["idempotency-key"]);
      if (!parseResult.ok) {
        switch (parseResult.reason) {
          case "missing":
            next(
              new AppError({
                statusCode: HTTP_STATUS.BAD_REQUEST,
                code: "IDEMPOTENCY_KEY_REQUIRED",
                message: "Idempotency-Key header is required.",
              }),
            );
            return;
          case "duplicate_header":
            next(
              new AppError({
                statusCode: HTTP_STATUS.BAD_REQUEST,
                code: "IDEMPOTENCY_KEY_INVALID",
                message: "Duplicate Idempotency-Key headers are not allowed.",
              }),
            );
            return;
          default:
            next(
              new AppError({
                statusCode: HTTP_STATUS.BAD_REQUEST,
                code: "IDEMPOTENCY_KEY_INVALID",
                message: "Invalid Idempotency-Key header format.",
              }),
            );
            return;
        }
      }
      const idempotencyKey = parseResult.key;

      const requestHash = generateRequestFingerprint({
        apiVersion,
        method: req.method,
        routePattern: options.routePattern,
        operation: options.operation,
        body: req.body && typeof req.body === "object" ? req.body : {},
      });

      const result = await service.acquire({
        userId,
        operation: options.operation,
        idempotencyKey,
        requestHash,
        leaseDurationSec,
      });

      switch (result.status) {
        case "in_progress": {
          const logger = getRequestLogger();
          logger?.info(
            { event: LOG_EVENTS.securityIdempotencyInProgress, operation: options.operation },
            "Idempotency key is currently in progress.",
          );
          next(
            new AppError({
              statusCode: HTTP_STATUS.CONFLICT,
              code: "IDEMPOTENCY_IN_PROGRESS",
              message: "A request with this Idempotency-Key is currently in progress.",
            }),
          );
          return;
        }

        case "conflict": {
          const logger = getRequestLogger();
          logger?.warn(
            { event: LOG_EVENTS.securityIdempotencyConflict, operation: options.operation },
            "Idempotency key exists with different request parameters.",
          );
          next(
            new AppError({
              statusCode: HTTP_STATUS.CONFLICT,
              code: "IDEMPOTENCY_CONFLICT",
              message: "Idempotency key already exists with different request parameters.",
            }),
          );
          return;
        }

        case "replay": {
          // Mark this response as an idempotency replay so that optional
          // fire-and-forget audit middleware can detect and skip it, preventing
          // duplicate audit log entries on repeat calls. (P4.5 requirement)
          res.locals.isIdempotencyReplay = true;
          if (result.responseStatus) res.status(result.responseStatus);
          let bodyToSend = result.responseBody;
          if (typeof bodyToSend === "string") {
            try {
              bodyToSend = JSON.parse(bodyToSend);
            } catch {
              // ignore
            }
          }
          res.json(bodyToSend);
          return;
        }

        case "acquired": {
          const { recordId, leaseToken } = result;

          let handlerResult: IdempotentHandlerResult<T>;
          try {
            handlerResult = await handler(req, res, next);
          } catch (handlerError) {
            // Unhandled error during execution: fail the lease if possible
            const logger = getRequestLogger();
            try {
              await service.fail({ recordId, leaseToken });
            } catch (failErr) {
              logger?.error({ err: failErr }, "Failed to mark idempotency record as failed.");
            }
            throw handlerError; // propagate to Express error handler
          }

          // Await completion RPC before sending response
          if (handlerResult.status >= 200 && handlerResult.status < 300) {
            try {
              const completed = await service.complete({
                recordId,
                leaseToken,
                responseStatus: handlerResult.status,
                responseBody: handlerResult.body,
              });
              if (!completed) {
                getRequestLogger()?.warn("Idempotency record was not completed (reclaimed?).");
              }
            } catch (completionError) {
              getRequestLogger()?.error(
                { err: completionError },
                "Idempotency completion RPC failed",
              );
            }
          } else {
            // For client errors (4xx), we might fail the lease to allow retries,
            // but let's just fail it to be safe.
            try {
              await service.fail({ recordId, leaseToken });
            } catch {
              // ignore
            }
          }

          res.status(handlerResult.status).json(handlerResult.body);
          return;
        }

        default:
          next(
            new AppError({
              statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
              code: "IDEMPOTENCY_SERVICE_UNAVAILABLE",
              message: "Idempotency service is currently unavailable.",
            }),
          );
          return;
      }
    } catch (err: unknown) {
      next(err);
    }
  };
}
