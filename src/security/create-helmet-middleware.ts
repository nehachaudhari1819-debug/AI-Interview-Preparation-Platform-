import helmet from "helmet";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";

export function createHelmetMiddleware(config: Readonly<ApplicationConfig>): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: config.runtime.isProduction ? [] : null,
      },
    },
    strictTransportSecurity: config.security.helmet.enableHsts
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        }
      : false,
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
    referrerPolicy: {
      policy: "no-referrer",
    },
    frameguard: {
      action: "deny",
    },
  });
}
