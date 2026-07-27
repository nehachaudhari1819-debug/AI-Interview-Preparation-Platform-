import { Router } from "express";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";
import { createQuestionsServiceMiddleware } from "./questions.middleware.js";
import {
  createGetQuestionsController,
  createGetQuestionDetailController,
  createGetTaxonomiesController,
} from "./questions.controller.js";

export function createQuestionsRouter(options: {
  config: Readonly<ApplicationConfig>;
  authMiddleware?: ReturnType<typeof createAuthenticationMiddleware>;
  activeAccountMiddleware?: RequestHandler;
  serviceMiddleware?: RequestHandler;
}): Router {
  const router = Router();

  const authMiddleware =
    options.authMiddleware ?? createAuthenticationMiddleware({ config: options.config });

  const activeAccountMiddleware =
    options.activeAccountMiddleware ?? createRequireActiveAccountMiddleware(options.config);

  const serviceMiddleware =
    options.serviceMiddleware ?? createQuestionsServiceMiddleware(options.config);

  const taxonomiesController = createGetTaxonomiesController();

  const attachTaxonomyParam = (type: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      req.params.taxonomyType = type;
      next();
    };
  };

  // Taxonomies
  const taxonomyRoutes = ["categories", "difficulties", "interview-types", "skills", "topics"];
  
  for (const type of taxonomyRoutes) {
    router.get(
      `/${type}`,
      authNoStoreMiddleware,
      authMiddleware,
      activeAccountMiddleware,
      serviceMiddleware,
      attachTaxonomyParam(type),
      taxonomiesController,
    );
  }

  // Questions Detail
  router.get(
    "/:questionId",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    serviceMiddleware,
    createGetQuestionDetailController(),
  );

  // Questions List
  router.get(
    "/",
    authNoStoreMiddleware,
    authMiddleware,
    activeAccountMiddleware,
    serviceMiddleware,
    createGetQuestionsController(),
  );

  return router;
}
