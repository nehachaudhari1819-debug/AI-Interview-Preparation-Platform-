import express, { type Express, type Router } from "express";

import { API_PREFIX } from "./constants/application.constants.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { createApiV1Router } from "./routes/api-v1.router.js";
import {
  createRequestLoggingMiddleware,
  createInFlightRequestMiddleware,
  createShutdownAdmissionMiddleware,
  type ObservabilitySystem,
} from "./observability/index.js";
import {
  createHealthService,
  createHealthController,
  createHealthRouter,
} from "./api/health/index.js";
import type { SafeConfigSummary } from "./config/config-summary.js";

import type { ApplicationConfig } from "./config/app-config.js";
import {
  createHelmetMiddleware,
  createCorsMiddleware,
  createGlobalApiRateLimiter,
  createJsonContentTypeGuard,
  cookieParserMiddleware,
  requestSecurityContextMiddleware,
  createApiRequestTargetGuard,
  apiMethodGuard,
  createJsonBodyParser,
  requestBodyErrorNormalizer,
} from "./security/index.js";

export type CreateAppOptions = {
  config: Readonly<ApplicationConfig>;
  apiRouter?: Router;
  observability?: ObservabilitySystem;
  configSummary?: SafeConfigSummary;
};

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  const apiRouter = options.apiRouter ?? createApiV1Router(options.config);

  // 1. Apply bounded trust proxy
  app.set(
    "trust proxy",
    options.config.security.trustProxyHops === 0 ? false : options.config.security.trustProxyHops,
  );

  // 2. Disable X-Powered-By
  app.disable("x-powered-by");

  // 3. Set simple query parser
  app.set("query parser", "simple");

  // 4. Initialize request ID/context
  app.use(requestIdMiddleware);

  // 5. Add request security context
  app.use(requestSecurityContextMiddleware);

  // 5.1 Add Request Logging and Lifecycle Middleware
  if (options.observability) {
    app.use(
      createRequestLoggingMiddleware({
        config: options.config,
        logger: options.observability.logger,
      }),
    );
    app.use(createInFlightRequestMiddleware({ tracker: options.observability.tracker }));
    app.use(createShutdownAdmissionMiddleware({ lifecycle: options.observability.lifecycle }));
  }

  // 6. Apply Helmet (before health so it gets security headers)
  app.use(createHelmetMiddleware(options.config));

  // Mount health endpoints
  if (options.observability && options.configSummary) {
    const healthService = createHealthService({
      lifecycle: options.observability.lifecycle,
      logger: options.observability.logger,
      configSummary: options.configSummary,
    });
    const healthController = createHealthController({ healthService });
    const healthRouter = createHealthRouter({ healthController });
    app.use("/health", healthRouter);
  }

  // 7. Apply CORS
  app.use(createCorsMiddleware(options.config));

  // 8. Apply request-target guard
  app.use(createApiRequestTargetGuard(options.config));

  // 9. Apply HTTP-method guard
  app.use(apiMethodGuard);

  // 10. Apply global API rate limiter
  app.use(createGlobalApiRateLimiter(options.config));

  // 11. Apply cookie parser
  app.use(cookieParserMiddleware);

  // 12. Apply content-type guard
  app.use(API_PREFIX, createJsonContentTypeGuard());

  // 13. Apply bounded JSON parser
  app.use(createJsonBodyParser(options.config));

  // 14. Mount API v1 router
  app.use(API_PREFIX, apiRouter);

  // 15. Apply not-found handler
  app.use(notFoundMiddleware);

  // 16. Normalize request-body parser errors
  app.use(requestBodyErrorNormalizer);

  // 17. Apply central error handler
  app.use(errorHandlerMiddleware);

  return app;
}
