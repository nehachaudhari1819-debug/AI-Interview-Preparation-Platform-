/**
 * P4.4 Admin Questions Router
 * P4.5 — Idempotency and Audit Integration
 *
 * Middleware ordering for all mutation routes (per P3.7 contract):
 *   request context
 *   → authentication          (router-level via router.use)
 *   → active-account check    (router-level via router.use)
 *   → admin-role check        (router-level via router.use)
 *   → JSON guard + parser     (mutation routes only)
 *   → createAuditMiddleware   (registers res.on("finish") listener)
 *   → withIdempotency wrapper (acquires lease, executes handler, completes lease)
 *       → idempotency handler: Zod validation → service call → set res.locals
 *       → idempotency completion (awaited before response is sent)
 *   → response
 *
 * Replay behavior:
 *   withIdempotency detects replay → sets res.locals.isIdempotencyReplay = true
 *   → sends cached response → res.on("finish") fires → audit middleware sees
 *   isIdempotencyReplay === true → skips audit (no duplicate event).
 *
 * GET routes do NOT apply idempotency or audit (read-only).
 *
 * Audit failure policy: fire-and-forget (best-effort, consistent with P3.7).
 * Idempotency-Key is REQUIRED on all mutation routes.
 */

import { Router, type Request, type RequestHandler } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";
import { createAuthenticationMiddleware } from "../../auth/create-authentication-middleware.js";
import { createRequireActiveAccountMiddleware } from "../../auth/require-active-account.middleware.js";
import { createRequireAdminRoleMiddleware } from "../../auth/require-admin-role.middleware.js";
import { AdminQuestionsService } from "./admin-questions.service.js";
import { SupabaseAdminQuestionsRepository } from "../../persistence/questions/supabase-admin-questions.repository.js";
import { createUserSupabaseClient } from "../../integrations/supabase/create-user-supabase-client.js";
import { extractBearerToken } from "../../auth/bearer-token.js";
import { createJsonContentTypeGuard, createJsonBodyParser } from "../../security/index.js";
import {
  withIdempotency,
  type IdempotentHandlerResult,
} from "../../middleware/idempotency.middleware.js";
import { createAuditMiddleware } from "../../middleware/audit.middleware.js";
import {
  QUESTION_IDEMPOTENCY_OPERATIONS,
  TAXONOMY_IDEMPOTENCY_OPERATIONS,
  QUESTION_BANK_ROUTE_PATTERNS,
} from "./admin-questions-idempotency.constants.js";
import {
  QUESTION_AUDIT_ACTIONS,
  TAXONOMY_AUDIT_ACTIONS,
  QUESTION_BANK_RESOURCE_TYPES,
  buildQuestionCreatedMetadata,
  buildQuestionUpdatedMetadata,
  buildQuestionLifecycleMetadata,
  buildTaxonomyCreatedMetadata,
  buildTaxonomyUpdatedMetadata,
  buildTaxonomyLifecycleMetadata,
} from "./admin-questions-audit.constants.js";
import {
  parseAdminGetQuestionsQuery,
  parseCreateQuestionBody,
  parseUpdateQuestionBody,
  parseCreateTaxonomyBody,
  parseUpdateTaxonomyBody,
} from "./admin-questions.schemas.js";
import { parseQuestionId, parseTaxonomyType } from "./questions.schemas.js";
import { asyncHandler } from "../../utils/async-handler.js";

export type AdminQuestionsRouterOptions = {
  config: Readonly<ApplicationConfig>;
  authenticationMiddleware?: RequestHandler;
  activeAccountMiddleware?: RequestHandler;
  adminRoleMiddleware?: RequestHandler;
};

/**
 * Creates a per-request AdminQuestionsService with the user's JWT.
 * RLS is applied transparently via the user-scoped Supabase client.
 */
function createServiceForRequest(
  req: Request,
  config: Readonly<ApplicationConfig>,
): AdminQuestionsService {
  const tokenResult = extractBearerToken(req.headers.authorization);
  const token = tokenResult.status === "present" ? tokenResult.token : "";
  const supabaseClient = createUserSupabaseClient({ config, accessToken: token });
  const repository = new SupabaseAdminQuestionsRepository(supabaseClient);
  return new AdminQuestionsService(repository);
}

export function createAdminQuestionsRouter(options: AdminQuestionsRouterOptions): Router {
  const router = Router();
  const { config } = options;

  const authMiddleware =
    options.authenticationMiddleware ?? createAuthenticationMiddleware({ config });
  const activeAccountMiddleware =
    options.activeAccountMiddleware ?? createRequireActiveAccountMiddleware(config);
  const adminRoleMiddleware =
    options.adminRoleMiddleware ?? createRequireAdminRoleMiddleware(config);

  // Enforce auth + admin globally on this router
  router.use(authMiddleware);
  router.use(activeAccountMiddleware);
  router.use(adminRoleMiddleware);

  const jsonGuard = createJsonContentTypeGuard();
  const jsonParser = createJsonBodyParser(config);

  // ---------------------------------------------------------------------------
  // GET /admin/questions — List Questions (no idempotency, no audit)
  // ---------------------------------------------------------------------------

  router.get(
    "/questions",
    asyncHandler(async (req, res) => {
      const query = parseAdminGetQuestionsQuery(req.query);
      const service = createServiceForRequest(req, config);
      const { questions, total } = await service.getQuestions(query);
      const totalPages = Math.ceil(total / query.limit);
      res.status(200).json({
        success: true,
        data: questions,
        meta: {
          requestId: req.context.requestId,
          totalItems: total,
          totalPages,
          currentPage: query.page,
          limit: query.limit,
          hasNextPage: query.page < totalPages,
          hasPreviousPage: query.page > 1,
        },
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // GET /admin/questions/:questionId — Get Question (no idempotency, no audit)
  // ---------------------------------------------------------------------------

  router.get(
    "/questions/:questionId",
    asyncHandler(async (req, res) => {
      const id = parseQuestionId(req.params.questionId);
      const service = createServiceForRequest(req, config);
      const question = await service.getQuestionById(id);
      res.status(200).json({
        success: true,
        data: question,
        meta: { requestId: req.context.requestId },
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/questions — Create Question
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_CREATED
  // ---------------------------------------------------------------------------

  router.post(
    "/questions",
    jsonGuard,
    jsonParser,
    createAuditMiddleware(config, {
      action: QUESTION_AUDIT_ACTIONS.QUESTION_CREATED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION,
    }),
    withIdempotency(
      config,
      {
        operation: QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_QUESTION,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const body = parseCreateQuestionBody(req.body);
        const service = createServiceForRequest(req, config);
        const question = await service.createQuestion(body);

        // Safe audit metadata: field names only, no values
        res.locals.auditResourceId = question.id;
        res.locals.auditMetadata = buildQuestionCreatedMetadata(Object.keys(body));

        return {
          status: 201,
          body: {
            success: true,
            data: question,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/questions/:questionId — Update Question
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_UPDATED
  // ---------------------------------------------------------------------------

  router.patch(
    "/questions/:questionId",
    jsonGuard,
    jsonParser,
    createAuditMiddleware(config, {
      action: QUESTION_AUDIT_ACTIONS.QUESTION_UPDATED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION,
    }),
    withIdempotency(
      config,
      {
        operation: QUESTION_IDEMPOTENCY_OPERATIONS.UPDATE_QUESTION,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.UPDATE_QUESTION,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const id = parseQuestionId(req.params.questionId);
        const body = parseUpdateQuestionBody(req.body);
        const service = createServiceForRequest(req, config);
        const question = await service.updateQuestion(id, body);

        res.locals.auditResourceId = question.id;
        res.locals.auditMetadata = buildQuestionUpdatedMetadata(Object.keys(body));

        return {
          status: 200,
          body: {
            success: true,
            data: question,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/questions/:questionId/publish — Publish Question
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_PUBLISHED
  // ---------------------------------------------------------------------------

  router.post(
    "/questions/:questionId/publish",
    createAuditMiddleware(config, {
      action: QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION,
    }),
    withIdempotency(
      config,
      {
        operation: QUESTION_IDEMPOTENCY_OPERATIONS.PUBLISH_QUESTION,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.PUBLISH_QUESTION,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const id = parseQuestionId(req.params.questionId);
        const service = createServiceForRequest(req, config);
        const question = await service.publishQuestion(id);

        res.locals.auditResourceId = question.id;
        res.locals.auditMetadata = buildQuestionLifecycleMetadata(
          QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED,
        );

        return {
          status: 200,
          body: {
            success: true,
            data: question,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/questions/:questionId/archive — Archive Question
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_ARCHIVED
  // ---------------------------------------------------------------------------

  router.post(
    "/questions/:questionId/archive",
    createAuditMiddleware(config, {
      action: QUESTION_AUDIT_ACTIONS.QUESTION_ARCHIVED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION,
    }),
    withIdempotency(
      config,
      {
        operation: QUESTION_IDEMPOTENCY_OPERATIONS.ARCHIVE_QUESTION,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_QUESTION,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const id = parseQuestionId(req.params.questionId);
        const service = createServiceForRequest(req, config);
        const question = await service.archiveQuestion(id);

        res.locals.auditResourceId = question.id;
        res.locals.auditMetadata = buildQuestionLifecycleMetadata(
          QUESTION_AUDIT_ACTIONS.QUESTION_ARCHIVED,
        );

        return {
          status: 200,
          body: {
            success: true,
            data: question,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/questions/:questionId/restore — Restore Question
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_RESTORED
  // ---------------------------------------------------------------------------

  router.post(
    "/questions/:questionId/restore",
    createAuditMiddleware(config, {
      action: QUESTION_AUDIT_ACTIONS.QUESTION_RESTORED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION,
    }),
    withIdempotency(
      config,
      {
        operation: QUESTION_IDEMPOTENCY_OPERATIONS.RESTORE_QUESTION,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.RESTORE_QUESTION,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const id = parseQuestionId(req.params.questionId);
        const service = createServiceForRequest(req, config);
        const question = await service.restoreQuestion(id);

        res.locals.auditResourceId = question.id;
        res.locals.auditMetadata = buildQuestionLifecycleMetadata(
          QUESTION_AUDIT_ACTIONS.QUESTION_RESTORED,
        );

        return {
          status: 200,
          body: {
            success: true,
            data: question,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/taxonomies/:taxonomyType — Create Taxonomy
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_TAXONOMY_CREATED
  // ---------------------------------------------------------------------------

  router.post(
    "/taxonomies/:taxonomyType",
    jsonGuard,
    jsonParser,
    createAuditMiddleware(config, {
      action: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION_TAXONOMY,
    }),
    withIdempotency(
      config,
      {
        operation: TAXONOMY_IDEMPOTENCY_OPERATIONS.CREATE_TAXONOMY,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.CREATE_TAXONOMY,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const type = parseTaxonomyType(req.params.taxonomyType);
        const body = parseCreateTaxonomyBody(req.body);
        const service = createServiceForRequest(req, config);
        const taxonomy = await service.createTaxonomy(type, body);

        res.locals.auditResourceId = taxonomy.id;
        res.locals.auditMetadata = buildTaxonomyCreatedMetadata(type, Object.keys(body));

        return {
          status: 201,
          body: {
            success: true,
            data: taxonomy,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // PATCH /admin/taxonomies/:taxonomyType/:taxonomyId — Update Taxonomy
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_TAXONOMY_UPDATED
  // ---------------------------------------------------------------------------

  router.patch(
    "/taxonomies/:taxonomyType/:taxonomyId",
    jsonGuard,
    jsonParser,
    createAuditMiddleware(config, {
      action: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION_TAXONOMY,
    }),
    withIdempotency(
      config,
      {
        operation: TAXONOMY_IDEMPOTENCY_OPERATIONS.UPDATE_TAXONOMY,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.UPDATE_TAXONOMY,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const type = parseTaxonomyType(req.params.taxonomyType);
        const id = parseQuestionId(req.params.taxonomyId);
        const body = parseUpdateTaxonomyBody(req.body);
        const service = createServiceForRequest(req, config);
        const taxonomy = await service.updateTaxonomy(type, id, body);

        res.locals.auditResourceId = taxonomy.id;
        res.locals.auditMetadata = buildTaxonomyUpdatedMetadata(type, Object.keys(body));

        return {
          status: 200,
          body: {
            success: true,
            data: taxonomy,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/taxonomies/:taxonomyType/:taxonomyId/archive — Archive Taxonomy
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_TAXONOMY_ARCHIVED
  // ---------------------------------------------------------------------------

  router.post(
    "/taxonomies/:taxonomyType/:taxonomyId/archive",
    createAuditMiddleware(config, {
      action: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION_TAXONOMY,
    }),
    withIdempotency(
      config,
      {
        operation: TAXONOMY_IDEMPOTENCY_OPERATIONS.ARCHIVE_TAXONOMY,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.ARCHIVE_TAXONOMY,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const type = parseTaxonomyType(req.params.taxonomyType);
        const id = parseQuestionId(req.params.taxonomyId);
        const service = createServiceForRequest(req, config);
        const taxonomy = await service.archiveTaxonomy(type, id);

        res.locals.auditResourceId = taxonomy.id;
        res.locals.auditMetadata = buildTaxonomyLifecycleMetadata(
          TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED,
          type,
        );

        return {
          status: 200,
          body: {
            success: true,
            data: taxonomy,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  // ---------------------------------------------------------------------------
  // POST /admin/taxonomies/:taxonomyType/:taxonomyId/restore — Restore Taxonomy
  //
  // Idempotency:   Required
  // Audit action:  QUESTION_TAXONOMY_RESTORED
  // ---------------------------------------------------------------------------

  router.post(
    "/taxonomies/:taxonomyType/:taxonomyId/restore",
    createAuditMiddleware(config, {
      action: TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED,
      resourceType: QUESTION_BANK_RESOURCE_TYPES.QUESTION_TAXONOMY,
    }),
    withIdempotency(
      config,
      {
        operation: TAXONOMY_IDEMPOTENCY_OPERATIONS.RESTORE_TAXONOMY,
        routePattern: QUESTION_BANK_ROUTE_PATTERNS.RESTORE_TAXONOMY,
        apiVersion: "v1",
      },
      async (req, res): Promise<IdempotentHandlerResult<unknown>> => {
        const type = parseTaxonomyType(req.params.taxonomyType);
        const id = parseQuestionId(req.params.taxonomyId);
        const service = createServiceForRequest(req, config);
        const taxonomy = await service.restoreTaxonomy(type, id);

        res.locals.auditResourceId = taxonomy.id;
        res.locals.auditMetadata = buildTaxonomyLifecycleMetadata(
          TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED,
          type,
        );

        return {
          status: 200,
          body: {
            success: true,
            data: taxonomy,
            meta: { requestId: req.context.requestId },
          },
        };
      },
    ),
  );

  return router;
}
