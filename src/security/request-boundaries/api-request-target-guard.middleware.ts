import type { Request, Response, NextFunction, RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { UriTooLongError } from "../../errors/uri-too-long.error.js";
import { TooManyQueryParametersError } from "../../errors/too-many-query-parameters.error.js";

export function createApiRequestTargetGuard(config: Readonly<ApplicationConfig>): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.originalUrl.startsWith("/api/v1")) {
      next();
      return;
    }

    if (request.originalUrl.length > config.requestBoundaries.maxUrlLength) {
      next(new UriTooLongError());
      return;
    }

    const url = new URL(request.originalUrl, "http://localhost");

    if (url.searchParams.size > config.requestBoundaries.maxQueryParameters) {
      next(new TooManyQueryParametersError());
      return;
    }

    next();
  };
}
