import type { Request, Response, NextFunction } from "express";
import { PayloadTooLargeError } from "../../errors/payload-too-large.error.js";
import { MalformedJsonError } from "../../errors/malformed-json.error.js";
import { UnsupportedContentEncodingError } from "../../errors/unsupported-content-encoding.error.js";

export function requestBodyErrorNormalizer(
  error: unknown,
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof (error as Record<string, unknown>).type === "string"
  ) {
    const errType = (error as Record<string, unknown>).type;

    if (errType === "entity.too.large") {
      next(new PayloadTooLargeError());
      return;
    }

    if (errType === "entity.parse.failed") {
      next(new MalformedJsonError());
      return;
    }

    if (errType === "encoding.unsupported") {
      next(new UnsupportedContentEncodingError());
      return;
    }
  }

  next(error);
}
