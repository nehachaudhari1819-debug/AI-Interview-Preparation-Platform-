import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  parseAdminGetQuestionsQuery,
  parseCreateQuestionBody,
  parseUpdateQuestionBody,
  parseCreateTaxonomyBody,
  parseUpdateTaxonomyBody,
} from "./admin-questions.schemas.js";
import { parseQuestionId, parseTaxonomyType } from "./questions.schemas.js";
import type { IAdminQuestionsService } from "./admin-questions.service.js";

export function createAdminQuestionsController(service: IAdminQuestionsService) {
  return {
    getQuestions: asyncHandler(async (req: Request, res: Response) => {
      const query = parseAdminGetQuestionsQuery(req.query);
      const { questions, total } = await service.getQuestions(query);
      const totalPages = Math.ceil(total / query.limit);
      const hasNextPage = query.page < totalPages;
      const hasPreviousPage = query.page > 1;

      res.status(200).json({
        success: true,
        data: questions,
        meta: {
          requestId: req.context.requestId,
          totalItems: total,
          totalPages,
          currentPage: query.page,
          limit: query.limit,
          hasNextPage,
          hasPreviousPage,
        },
      });
    }),

    getQuestionById: asyncHandler(async (req: Request, res: Response) => {
      const id = parseQuestionId(req.params.questionId);
      const question = await service.getQuestionById(id);

      res.status(200).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    createQuestion: asyncHandler(async (req: Request, res: Response) => {
      const body = parseCreateQuestionBody(req.body);

      const question = await service.createQuestion(body);

      res.status(201).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    updateQuestion: asyncHandler(async (req: Request, res: Response) => {
      const id = parseQuestionId(req.params.questionId);
      const body = parseUpdateQuestionBody(req.body);

      const question = await service.updateQuestion(id, body);

      res.status(200).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    publishQuestion: asyncHandler(async (req: Request, res: Response) => {
      const id = parseQuestionId(req.params.questionId);
      const question = await service.publishQuestion(id);

      res.status(200).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    archiveQuestion: asyncHandler(async (req: Request, res: Response) => {
      const id = parseQuestionId(req.params.questionId);
      const question = await service.archiveQuestion(id);

      res.status(200).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    restoreQuestion: asyncHandler(async (req: Request, res: Response) => {
      const id = parseQuestionId(req.params.questionId);
      const question = await service.restoreQuestion(id);

      res.status(200).json({
        success: true,
        data: question,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    createTaxonomy: asyncHandler(async (req: Request, res: Response) => {
      const type = parseTaxonomyType(req.params.taxonomyType);
      const body = parseCreateTaxonomyBody(req.body);
      const taxonomy = await service.createTaxonomy(type, body);

      res.status(201).json({
        success: true,
        data: taxonomy,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    updateTaxonomy: asyncHandler(async (req: Request, res: Response) => {
      const type = parseTaxonomyType(req.params.taxonomyType);
      const id = parseQuestionId(req.params.taxonomyId); // Validates UUID format
      const body = parseUpdateTaxonomyBody(req.body);
      const taxonomy = await service.updateTaxonomy(type, id, body);

      res.status(200).json({
        success: true,
        data: taxonomy,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    archiveTaxonomy: asyncHandler(async (req: Request, res: Response) => {
      const type = parseTaxonomyType(req.params.taxonomyType);
      const id = parseQuestionId(req.params.taxonomyId);
      const taxonomy = await service.archiveTaxonomy(type, id);

      res.status(200).json({
        success: true,
        data: taxonomy,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),

    restoreTaxonomy: asyncHandler(async (req: Request, res: Response) => {
      const type = parseTaxonomyType(req.params.taxonomyType);
      const id = parseQuestionId(req.params.taxonomyId);
      const taxonomy = await service.restoreTaxonomy(type, id);

      res.status(200).json({
        success: true,
        data: taxonomy,
        meta: {
          requestId: req.context.requestId,
        },
      });
    }),
  };
}
