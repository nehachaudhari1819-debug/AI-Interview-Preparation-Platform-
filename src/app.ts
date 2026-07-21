import express, { type Express, type Router } from "express";

import {
  API_PREFIX,
  DEFAULT_JSON_BODY_LIMIT,
  DEFAULT_URL_ENCODED_BODY_LIMIT,
} from "./constants/application.constants.js";
import { errorHandlerMiddleware } from "./middleware/error-handler.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { createApiV1Router } from "./routes/api-v1.router.js";

import type { ApplicationConfig } from "./config/app-config.js";
import {
  createHelmetMiddleware,
  createCorsMiddleware,
  createApiRateLimitMiddleware,
  createJsonContentTypeGuard,
  cookieParserMiddleware,
  requestSecurityContextMiddleware,
} from "./security/index.js";

export type CreateAppOptions = {
  config: Readonly<ApplicationConfig>;
  apiRouter?: Router;
};

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  const apiRouter = options.apiRouter ?? createApiV1Router();

  app.disable("x-powered-by");

  app.set(
    "trust proxy",
    options.config.security.trustProxyHops === 0 ? false : options.config.security.trustProxyHops,
  );

  app.use(createHelmetMiddleware(options.config));
  app.use(requestIdMiddleware);
  app.use(requestSecurityContextMiddleware);
  app.use(createCorsMiddleware(options.config));
  app.use(createApiRateLimitMiddleware(options.config));
  app.use(API_PREFIX, createJsonContentTypeGuard());

  app.use(
    express.json({
      limit: DEFAULT_JSON_BODY_LIMIT,
    }),
  );

  app.use(cookieParserMiddleware);

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}
