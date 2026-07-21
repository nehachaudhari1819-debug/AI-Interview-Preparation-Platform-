import type { RequestHandler } from "express";
import { UnsupportedMediaTypeError } from "../errors/unsupported-media-type.error.js";
import { SAFE_HTTP_METHODS, JSON_MEDIA_TYPES } from "./security.constants.js";

export function createJsonContentTypeGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_HTTP_METHODS.has(req.method)) {
      next();
      return;
    }

    const contentLength = req.headers["content-length"];
    const hasContentLength = contentLength !== undefined && contentLength !== "0";
    const hasTransferEncoding = req.headers["transfer-encoding"] !== undefined;
    const hasBody = hasContentLength || hasTransferEncoding;

    if (!hasBody) {
      next();
      return;
    }

    const contentType = req.headers["content-type"];
    if (!contentType) {
      next(
        new UnsupportedMediaTypeError("Content-Type header is required for requests with a body."),
      );
      return;
    }

    const isJson = JSON_MEDIA_TYPES.some((type) => contentType.includes(type));
    if (!isJson) {
      next(new UnsupportedMediaTypeError("Only application/json is supported."));
      return;
    }

    next();
  };
}
