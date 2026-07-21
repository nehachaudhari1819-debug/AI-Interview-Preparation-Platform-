import type { RequestHandler } from "express";
import { normalizeOrigin } from "./trusted-origin.js";

const VALID_FETCH_SITES = new Set(["same-origin", "same-site", "cross-site", "none"]);

export const requestSecurityContextMiddleware: RequestHandler = (req, res, next) => {
  let origin: string | undefined;
  if (req.headers.origin) {
    try {
      origin = normalizeOrigin(req.headers.origin as string);
    } catch {
      // Invalid origin is omitted
    }
  }

  let fetchSite: string | undefined;
  const rawFetchSite = req.headers["sec-fetch-site"];
  if (typeof rawFetchSite === "string" && VALID_FETCH_SITES.has(rawFetchSite)) {
    fetchSite = rawFetchSite;
  }

  req.context = {
    ...req.context,
    security: {
      clientIp: req.ip ?? "unknown",
      protocol: req.protocol === "https" ? "https" : "http",
      isSecure: req.secure,
      origin,
      fetchSite,
    },
  };

  next();
};
