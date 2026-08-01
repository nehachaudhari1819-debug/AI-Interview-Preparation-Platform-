import { Router } from "express";
import type { RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { authNoStoreMiddleware } from "../auth/auth-no-store.middleware.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";
import { createInterviewsServiceMiddleware } from "./interviews.middleware.js";
import { createInterviewsController } from "./interviews.controller.js";
import { withIdempotency } from "../../middleware/idempotency.middleware.js";

export function createInterviewsRouter(options: {
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
    options.serviceMiddleware ?? createInterviewsServiceMiddleware(options.config);

  const controller = createInterviewsController();

  // Root middleware
  router.use(authNoStoreMiddleware, authMiddleware, activeAccountMiddleware, serviceMiddleware);

  router.post(
    "/",
    withIdempotency(
      options.config,
      {
        operation: "INTERVIEWS_CREATE_INTERVIEW",
        routePattern: "/api/v1/interviews",
        apiVersion: "v1",
      },
      controller.createInterviewHandler,
    ),
  );
  router.get("/", controller.getInterviews);
  router.get("/:interviewId", controller.getInterviewById);
  router.patch(
    "/:interviewId",
    withIdempotency(
      options.config,
      {
        operation: "INTERVIEWS_UPDATE_INTERVIEW",
        routePattern: "/api/v1/interviews/:interviewId",
        apiVersion: "v1",
      },
      controller.updateInterviewHandler,
    ),
  );

  router.post("/:interviewId/sessions", controller.createSession);
  router.get("/:interviewId/sessions", controller.getInterviewSessions);
  router.get("/:interviewId/sessions/:sessionId", controller.getInterviewSessionById);

  router.get("/:interviewId/sessions/:sessionId/questions", controller.getSessionQuestions);
  router.get(
    "/:interviewId/sessions/:sessionId/questions/:sessionQuestionId",
    controller.getSessionQuestionById,
  );

  router.post("/:interviewId/sessions/:sessionId/start", controller.startSession);
  router.post("/:interviewId/sessions/:sessionId/pause", controller.pauseSession);
  router.post("/:interviewId/sessions/:sessionId/resume", controller.resumeSession);
  router.post("/:interviewId/sessions/:sessionId/complete", controller.completeSession);

  return router;
}
