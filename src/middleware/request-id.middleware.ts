import type { NextFunction, Request, Response } from "express";

import { createRequestId } from "../utils/request-id.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const candidate = request.header("X-Request-ID");

  const requestId =
    candidate !== undefined &&
    candidate.length <= 64 &&
    UUID_PATTERN.test(candidate)
      ? candidate
      : createRequestId();

  request.context = {
    requestId,
  };

  response.setHeader("X-Request-ID", requestId);

  next();
}
