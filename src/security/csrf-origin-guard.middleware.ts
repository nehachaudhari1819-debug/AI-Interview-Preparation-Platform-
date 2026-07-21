import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { SAFE_HTTP_METHODS } from "./security.constants.js";
import { CsrfOriginError } from "../errors/csrf-origin.error.js";
import { isTrustedOrigin, normalizeOrigin } from "./trusted-origin.js";

export function createCsrfOriginGuard(config: Readonly<ApplicationConfig>): RequestHandler {
  return (req, res, next) => {
    if (SAFE_HTTP_METHODS.has(req.method)) {
      next();
      return;
    }

    if (req.context.security.fetchSite === "cross-site") {
      next(new CsrfOriginError());
      return;
    }

    let originToCheck = req.context.security.origin;

    if (!originToCheck && req.headers.referer) {
      try {
        originToCheck = normalizeOrigin(req.headers.referer);
      } catch {
        // malformed referer
      }
    }

    if (!originToCheck) {
      next(new CsrfOriginError());
      return;
    }

    if (isTrustedOrigin(originToCheck, config.security.cors.allowedOrigins)) {
      next();
      return;
    }

    next(new CsrfOriginError());
  };
}
