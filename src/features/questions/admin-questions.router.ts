import { Router, type Request, type RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";
import { createRequireAdminRoleMiddleware } from "../../auth/require-admin-role.middleware.js";
import { createAdminQuestionsController } from "./admin-questions.controller.js";
import { AdminQuestionsService } from "./admin-questions.service.js";
import { SupabaseAdminQuestionsRepository } from "../../persistence/questions/supabase-admin-questions.repository.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { extractBearerToken } from "../../auth/bearer-token.js";
import { createJsonContentTypeGuard, createJsonBodyParser } from "../../security/index.js";

export type AdminQuestionsRouterOptions = {
  config: Readonly<ApplicationConfig>;
  authenticationMiddleware?: RequestHandler;
  activeAccountMiddleware?: RequestHandler;
  adminRoleMiddleware?: RequestHandler;
};

export function createAdminQuestionsRouter(options: AdminQuestionsRouterOptions): Router {
  const router = Router();
  const config = options.config;

  const authMiddleware =
    options.authenticationMiddleware ?? createAuthenticationMiddleware({ config });
  const activeAccountMiddleware =
    options.activeAccountMiddleware ?? createRequireActiveAccountMiddleware(config);
  const adminRoleMiddleware =
    options.adminRoleMiddleware ?? createRequireAdminRoleMiddleware(config);

  // Enforce admin globally on this router
  router.use(authMiddleware);
  router.use(activeAccountMiddleware);
  router.use(adminRoleMiddleware);

  const jsonGuard = createJsonContentTypeGuard();
  const jsonParser = createJsonBodyParser(config);

  // Lazy injection for per-request repository with user JWT
  const getController = (req: Request) => {
    // In Express, we can instantiate per-request or just pass the token.
    // To match architecture, we instantiate the Supabase client with the user's token so RLS is applied (even though it's admin, they have a JWT).
    // The admin policies allow them to do everything.
    const tokenResult = extractBearerToken(req.headers.authorization);
    const token = tokenResult.status === "present" ? tokenResult.token : "";

    const supabaseClient = createUserSupabaseClient({
      config,
      accessToken: token,
    });

    const repository = new SupabaseAdminQuestionsRepository(supabaseClient);
    const service = new AdminQuestionsService(repository);
    return createAdminQuestionsController(service);
  };

  // Taxonomies
  router.post("/taxonomies/:taxonomyType", jsonGuard, jsonParser, (req, res, next) => {
    getController(req).createTaxonomy(req, res, next);
  });

  router.patch("/taxonomies/:taxonomyType/:taxonomyId", jsonGuard, jsonParser, (req, res, next) => {
    getController(req).updateTaxonomy(req, res, next);
  });

  router.post("/taxonomies/:taxonomyType/:taxonomyId/archive", (req, res, next) => {
    getController(req).archiveTaxonomy(req, res, next);
  });

  router.post("/taxonomies/:taxonomyType/:taxonomyId/restore", (req, res, next) => {
    getController(req).restoreTaxonomy(req, res, next);
  });

  // Questions
  router.post("/questions", jsonGuard, jsonParser, (req, res, next) => {
    getController(req).createQuestion(req, res, next);
  });

  router.get("/questions", (req, res, next) => {
    getController(req).getQuestions(req, res, next);
  });

  router.get("/questions/:questionId", (req, res, next) => {
    getController(req).getQuestionById(req, res, next);
  });

  router.patch("/questions/:questionId", jsonGuard, jsonParser, (req, res, next) => {
    getController(req).updateQuestion(req, res, next);
  });

  router.post("/questions/:questionId/publish", (req, res, next) => {
    getController(req).publishQuestion(req, res, next);
  });

  router.post("/questions/:questionId/archive", (req, res, next) => {
    getController(req).archiveQuestion(req, res, next);
  });

  router.post("/questions/:questionId/restore", (req, res, next) => {
    getController(req).restoreQuestion(req, res, next);
  });

  return router;
}
