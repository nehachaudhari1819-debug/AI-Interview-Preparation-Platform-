import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess, sendMetaCollection } from "../../utils/api-response.js";
import { HTTP_STATUS } from "../../constants/http.constants.js";
import type { IInterviewsService } from "./interviews.service.js";
import {
  parseCreateInterviewBody,
  parseUpdateInterviewBody,
  parseGetInterviewsQuery,
  parseGetSessionsQuery,
  parseId,
  parseStrictEmptyBody,
} from "./interviews.schemas.js";
import { ValidationError } from "../../errors/validation.error.js";
import {
  mapInterviewToResponse,
  mapSessionToResponse,
  mapSessionQuestionToResponse,
} from "./interviews-response.mapper.js";
import { parseIdempotencyKey } from "../../domain/idempotency/idempotency-key.js";

function getService(res: Response): IInterviewsService {
  const service = res.locals.interviewsService as IInterviewsService | undefined;
  if (!service) {
    throw new Error("InterviewsService not found in request context");
  }
  return service;
}

export function createInterviewsController() {
  return {
    createInterviewHandler: async (req: Request, res: Response) => {
      const service = getService(res);
      const body = parseCreateInterviewBody(req.body);

      const interview = await service.createInterview(body);
      const safeData = mapInterviewToResponse(interview);

      return {
        status: HTTP_STATUS.CREATED,
        body: {
          success: true,
          data: safeData,
          meta: { requestId: req.context.requestId },
        },
      };
    },

    updateInterviewHandler: async (req: Request, res: Response) => {
      const service = getService(res);
      const id = parseId(req.params.interviewId);
      const body = parseUpdateInterviewBody(req.body);

      const interview = await service.updateInterview(id, body);
      const safeData = mapInterviewToResponse(interview);

      return {
        status: HTTP_STATUS.OK,
        body: {
          success: true,
          data: safeData,
          meta: { requestId: req.context.requestId },
        },
      };
    },

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
      const query = parseGetSessionsQuery(req.query);

      const result = await service.getInterviewSessions(interviewId, query);
      const safeData = result.items.map(mapSessionToResponse);

      return sendMetaCollection({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        pagination: result.pagination,
        requestId: req.context.requestId,
      });
    }),

    createSession: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const parsedIdempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
      if (!parsedIdempotencyKey.ok) {
        throw new ValidationError(`Invalid Idempotency-Key: ${parsedIdempotencyKey.reason}`);
      }
      const idempotencyKey = parsedIdempotencyKey.key;

      const contentType = req.get("Content-Type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new ValidationError("Content-Type must be application/json");
      }
      parseStrictEmptyBody(req.body);

      const { replayed, snapshot } = await service.createSession(interviewId, idempotencyKey);
      const safeData = mapSessionToResponse(snapshot);

      if (replayed) {
        res.setHeader("X-Idempotency-Replay", "true");
      }

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.CREATED,
        data: safeData,
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

      const questions = await service.getSessionQuestions(interviewId, sessionId);
      const safeData = questions.map(mapSessionQuestionToResponse);

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
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

    startSession: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const parsedIdempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
      if (!parsedIdempotencyKey.ok) {
        throw new ValidationError(`Invalid Idempotency-Key: ${parsedIdempotencyKey.reason}`);
      }
      const idempotencyKey = parsedIdempotencyKey.key;

      parseStrictEmptyBody(req.body);

      const { replayed, snapshot } = await service.startSession(
        interviewId,
        sessionId,
        idempotencyKey,
      );
      const safeData = mapSessionToResponse(snapshot);

      if (replayed) {
        res.setHeader("X-Idempotency-Replay", "true");
      }

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    pauseSession: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const parsedIdempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
      if (!parsedIdempotencyKey.ok) {
        throw new ValidationError(`Invalid Idempotency-Key: ${parsedIdempotencyKey.reason}`);
      }
      const idempotencyKey = parsedIdempotencyKey.key;
      parseStrictEmptyBody(req.body);

      const { replayed, snapshot } = await service.pauseSession(
        interviewId,
        sessionId,
        idempotencyKey,
      );
      const safeData = mapSessionToResponse(snapshot);

      if (replayed) {
        res.setHeader("X-Idempotency-Replay", "true");
      }

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    resumeSession: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const parsedIdempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
      if (!parsedIdempotencyKey.ok) {
        throw new ValidationError(`Invalid Idempotency-Key: ${parsedIdempotencyKey.reason}`);
      }
      const idempotencyKey = parsedIdempotencyKey.key;
      parseStrictEmptyBody(req.body);

      const { replayed, snapshot } = await service.resumeSession(
        interviewId,
        sessionId,
        idempotencyKey,
      );
      const safeData = mapSessionToResponse(snapshot);

      if (replayed) {
        res.setHeader("X-Idempotency-Replay", "true");
      }

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),

    completeSession: asyncHandler(async (req: Request, res: Response) => {
      const service = getService(res);
      const interviewId = parseId(req.params.interviewId);
      const sessionId = parseId(req.params.sessionId);
      const parsedIdempotencyKey = parseIdempotencyKey(req.get("Idempotency-Key"));
      if (!parsedIdempotencyKey.ok) {
        throw new ValidationError(`Invalid Idempotency-Key: ${parsedIdempotencyKey.reason}`);
      }
      const idempotencyKey = parsedIdempotencyKey.key;
      parseStrictEmptyBody(req.body);

      const { replayed, snapshot } = await service.completeSession(
        interviewId,
        sessionId,
        idempotencyKey,
      );
      const safeData = mapSessionToResponse(snapshot);

      if (replayed) {
        res.setHeader("X-Idempotency-Replay", "true");
      }

      return sendSuccess({
        response: res,
        statusCode: HTTP_STATUS.OK,
        data: safeData,
        requestId: req.context.requestId,
      });
    }),
  };
}
