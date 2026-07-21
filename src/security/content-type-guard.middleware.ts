import type { RequestHandler } from "express";
import { UnsupportedMediaTypeError } from "../errors/unsupported-media-type.error.js";
import { SAFE_HTTP_METHODS, JSON_MEDIA_TYPES } from "./security.constants.js";

export function createJsonContentTypeGuard(): RequestHandler {
  return (req, res, next) => {
    if (SAFE_HTTP_METHODS.has(req.method)) {
      return next();
    }

    const contentLength = req.headers["content-length"];
    const hasContentLength = contentLength !== undefined && contentLength !== "0";
    const hasTransferEncoding = req.headers["transfer-encoding"] !== undefined;
    const hasBody = hasContentLength || hasTransferEncoding;

    if (!hasBody) {
      return next();
    }

    const contentType = req.headers["content-type"];
    if (!contentType) {
      return next(new UnsupportedMediaTypeError());
    }

    const isJson = JSON_MEDIA_TYPES.some((type) => contentType.includes(type));
    if (!isJson) {
      return next(new UnsupportedMediaTypeError());
    }

    next();
  };
}
