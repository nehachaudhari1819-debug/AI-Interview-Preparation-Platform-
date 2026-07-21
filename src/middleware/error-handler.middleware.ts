import type { ErrorRequestHandler } from "express";

import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "../errors/app-error.js";
import type { ApiErrorResponse } from "../types/api-response.types.js";

type ExpressBodyParserError = Error & {
  status?: number;
  statusCode?: number;
  type?: string;
};

function isBodyParserError(error: unknown): error is ExpressBodyParserError {
  return error instanceof Error && "type" in error;
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
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

  if (!appError.isOperational) {
    console.error("Unhandled application error.", {
      requestId,
      error,
    });
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

  response.status(appError.statusCode).json(body);
};
