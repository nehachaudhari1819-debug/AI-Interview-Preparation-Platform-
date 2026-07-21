import cors from "cors";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../config/app-config.js";
import { CorsOriginError } from "../errors/cors-origin.error.js";
import {
  CORS_ALLOWED_METHODS,
  CORS_ALLOWED_HEADERS,
  CORS_EXPOSED_HEADERS,
} from "./security.constants.js";
import { isTrustedOrigin } from "./trusted-origin.js";

export function createCorsMiddleware(config: Readonly<ApplicationConfig>): RequestHandler {
  return cors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, origin?: string | boolean) => void,
    ) => {
      if (!requestOrigin) {
        callback(null, true);
        return;
      }

      if (isTrustedOrigin(requestOrigin, config.security.cors.allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new CorsOriginError(requestOrigin));
    },
    credentials: config.security.cors.credentials,
    methods: CORS_ALLOWED_METHODS as unknown as string[],
    allowedHeaders: CORS_ALLOWED_HEADERS as unknown as string[],
    exposedHeaders: CORS_EXPOSED_HEADERS as unknown as string[],
    maxAge: config.security.cors.preflightMaxAgeSeconds,
    optionsSuccessStatus: 204,
  });
}
