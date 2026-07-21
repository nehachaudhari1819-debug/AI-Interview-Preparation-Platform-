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

export type CreateAppOptions = {
  apiRouter?: Router;
};

export function createApp(options: CreateAppOptions = {}): Express {
  const app = express();
  const apiRouter = options.apiRouter ?? createApiV1Router();

  app.disable("x-powered-by");

  app.use(requestIdMiddleware);

  app.use(
    express.json({
      limit: DEFAULT_JSON_BODY_LIMIT,
    }),
  );

  app.use(
    express.urlencoded({
      extended: false,
      limit: DEFAULT_URL_ENCODED_BODY_LIMIT,
    }),
  );

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundMiddleware);
  app.use(errorHandlerMiddleware);

  return app;
}

export const app = createApp();
