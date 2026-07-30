import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess, sendMetaCollection } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import type { IInterviewsService } from "./interviews.service.js";
import {
  parseCreateInterviewBody,
  parseUpdateInterviewBody,
  parseGetInterviewsQuery,
  parsePaginationQuery,
  parseId,
} from "./interviews.schemas.js";
import {
  mapInterviewToResponse,
  mapSessionToResponse,
  mapSessionQuestionToResponse,
} from "./interviews-response.mapper.js";

function getService(res: Response): IInterviewsService {
  const service = res.locals.interviewsService as IInterviewsService | undefined;
  if (!service) {
    throw new Error("InterviewsService not found in request context");
  }
  return service;
}

export function createInterviewsController() {
  return {
    createInterview: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const body = parseCreateInterviewBody(req.body);

      const interview = await service.createInterview(body);
      const safeData = mapInterviewToResponse(interview);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.CREATED,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    updateInterview: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const id = parseId(req.params.interviewId);
      const body = parseUpdateInterviewBody(req.body);

      const interview = await service.updateInterview(id, body);
      const safeData = mapInterviewToResponse(interview);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    getInterviews: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const query = parseGetInterviewsQuery(req.query);

      const result = await service.getInterviews(query);
      const safeData = result.items.map(mapInterviewToResponse);

      return sendMetaCollection({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        pagination: result.pagination,
        requestId: req.context.requestId,
      });
    }),

    getInterviewById: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const id = parseId(req.params.interviewId);

      const interview = await service.getInterviewById(id);
      const safeData = mapInterviewToResponse(interview);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    getInterviewSessions: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const query = parsePaginationQuery(req.query);

      const result = await service.getInterviewSessions(interviewId, {
        ...query,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      const safeData = result.items.map(mapSessionToResponse);

      return sendMetaCollection({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        pagination: result.pagination,
        requestId: req.context.requestId,
      });
    }),

    getInterviewSessionById: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);

      const session = await service.getInterviewSessionById(interviewId, sessionId);
      const safeData = mapSessionToResponse(session);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    getSessionQuestions: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const query = parsePaginationQuery(req.query);

      const result = await service.getSessionQuestions(interviewId, sessionId, {
        ...query,
        sortBy: "createdAt",
        sortDir: "asc",
      });
      const safeData = result.items.map(mapSessionQuestionToResponse);

      return sendMetaCollection({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        pagination: result.pagination,
        requestId: req.context.requestId,
      });
    }),

    getSessionQuestionById: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const sessionQuestionId = parseId(req.params.sessionQuestionId);

      const question = await service.getSessionQuestionById(
        interviewId,
        sessionId,
        sessionQuestionId,
      );
      const safeData = mapSessionQuestionToResponse(question);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),
  };
}
