import type { ErrorRequestHandler } from "express";

import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "../errors/app-error.js";

import type { ApiErrorResponse } from "../types/api-response.types.js";
import {
  safeErrorSerializer,
  LOG_EVENTS,
  getRequestLogger,
} from "../observability/logging/index.js";

type ExpressBodyParserError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

function isBodyParserError(error: unknown): error is ExpressBodyParserError {
  return error instanceof Error && "type" in error;
}

function normalizeError(error: unknown): AppError {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const errRec = error as unknown as Record<string, unknown>;
  if (errRec.isAppError) {
    return error as AppError;
  }

  if (isBodyParserError(error)) {
    if (error.type === "entity.too.large") {
      return new AppError({
        statusCode: HTTP_STATUS.PAYLOAD_TOO_LARGE,
        code: ERROR_CODES.PAYLOAD_TOO_LARGE,
        message: "Request payload is too large.",
        isOperational: true,
      });
    }

    if (error.type === "entity.parse.failed") {
      return new AppError({
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: ERROR_CODES.INVALID_JSON,
        message: "Request body contains invalid JSON.",
        isOperational: true,
      });
    }
  }

  return new AppError({
    statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: "An unexpected error occurred.",
    isOperational: false,
    cause: error,
  });
}

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const requestId = request.context.requestId;
  const appError = normalizeError(error);

  const logger = request.log ?? getRequestLogger();
  if (logger) {
    const serializedError = safeErrorSerializer(error);
    let level: "info" | "warn" | "error" = "error";

    if (appError.statusCode < 500) {
      level = appError.statusCode === HTTP_STATUS.TOO_MANY_REQUESTS ? "warn" : "info";
    }

    logger[level]({
      event: LOG_EVENTS.httpRequestError,
      requestId,
      method: request.method,
      path: request.path,
      statusCode: appError.statusCode,
      error: serializedError,
    });
  } else if (!appError.isOperational) {
    console.error("Unhandled error:", error);
  }

  const body: ApiErrorResponse = {
    success: false,
    message: appError.message,
    code: appError.code,
    meta: {
      requestId,
    },
    ...(appError.errors === undefined ? {} : { errors: appError.errors }),
  };

  const errRec = appError as unknown as Record<string, unknown>;
  if (errRec.isAuthenticationError && typeof errRec.challenge === "string") {
    response.setHeader("WWW-Authenticate", errRec.challenge);
  }

  response.status(appError.statusCode).json(body);
};
