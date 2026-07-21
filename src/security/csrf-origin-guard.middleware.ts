import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { SAFE_HTTP_METHODS } from "./security.constants.js";
import { CsrfOriginError } from "../errors/csrf-origin.error.js";
import { isTrustedOrigin, normalizeOrigin } from "./trusted-origin.js";

export function createCsrfOriginGuard(config: Readonly<ApplicationConfig>): RequestHandler {
  return (req, res, next) => {
    if (SAFE_HTTP_METHODS.has(req.method)) {
      return next();
    }

    if (req.context?.security?.fetchSite === "cross-site") {
      return next(new CsrfOriginError());
    }

    let originToCheck = req.context?.security?.origin;

    if (!originToCheck && req.headers.referer) {
      try {
        originToCheck = normalizeOrigin(req.headers.referer);
      } catch {
        // malformed referer
      }
    }

    if (!originToCheck) {
      return next(new CsrfOriginError());
    }

    if (!isTrustedOrigin(originToCheck, config.security.cors.allowedOrigins)) {
      return next(new CsrfOriginError());
    }

    next();
  };
}
