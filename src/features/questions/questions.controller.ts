import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess, sendCollection } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import { NotFoundError } from "../../errors/not-found.error.js";
import type { QuestionsService } from "./questions.service.js";
import {
  parseGetQuestionsQuery,
  parseQuestionId,
  parseTaxonomyType,
} from "./questions.schemas.js";
import {
  mapQuestionToSummary,
  mapQuestionToDetail,
  mapTaxonomyToResponse,
} from "./questions-response.mapper.js";

function getService(res: Response): QuestionsService {
  const service = res.locals.questionsService as QuestionsService | undefined;
  if (!service) {
    throw new Error("QuestionsService not found in request context");
  }
  return service;
}

export function createGetQuestionsController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const service = getService(res);
    const query = parseGetQuestionsQuery(req.query);

    const result = await service.getQuestions(query);
    const safeData = result.items.map(mapQuestionToSummary);

    return sendCollection({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: safeData,
      pagination: result.pagination,
      requestId: req.context.requestId,
    });
  });
}

export function createGetQuestionDetailController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const service = getService(res);
    const id = parseQuestionId(req.params.questionId);

    const question = await service.getQuestionDetail(id);

    if (!question) {
      throw new NotFoundError("Question not found");
    }

    const safeData = mapQuestionToDetail(question);

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: safeData,
      requestId: req.context.requestId,
    });
  });
}

export function createGetTaxonomiesController() {
  return asyncHandler(async (req: Request, res: Response) => {
    const service = getService(res);
    
    // In Express, when defining a route like /taxonomies/:taxonomyType
    // we can parse the type.
    const type = parseTaxonomyType(req.params.taxonomyType);

    const taxonomies = await service.getTaxonomies(type);
    const safeData = taxonomies.map(mapTaxonomyToResponse);

    return sendSuccess({
      response: res,
      statusCode: HTTP_STATUS.OK,
      data: safeData,
      requestId: req.context.requestId,
    });
  });
}
