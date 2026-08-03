import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createInterviewsController } from "../../../../src/features/interviews/interviews.controller.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";

describe("InterviewsController Lifecycle Methods", () => {
  let mockService: any;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let controller: ReturnType<typeof createInterviewsController>;

  const createValidSessionSnapshot = () => ({
    id: "123e4567-e89b-12d3-a456-426614174001",
    interview_id: "123e4567-e89b-12d3-a456-426614174000",
    status: "in_progress" as const,
    config_snapshot: {
      title: "Backend Interview",
      targetRole: "Backend Engineer",
      questionCount: 5,
      timeLimitMinutes: 30,
      interviewType: {
        id: "123e4567-e89b-12d3-a456-426614174010",
        name: "Technical",
      },
      difficulty: {
        id: "123e4567-e89b-12d3-a456-426614174011",
        name: "Intermediate",
      },
      skills: [
        {
          id: "123e4567-e89b-12d3-a456-426614174012",
          name: "Node.js",
        },
      ],
      topics: [
        {
          id: "123e4567-e89b-12d3-a456-426614174013",
          name: "APIs",
        },
      ],
    },
    started_at: "2026-08-01T00:00:00.000Z",
    paused_at: null,
    total_paused_seconds: 0,
    completed_at: null,
    last_transition_at: "2026-08-01T00:00:00.000Z",
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
  });

  const createValidAnswerSnapshot = () => ({
    id: "123e4567-e89b-12d3-a456-426614174003",
    sessionQuestionId: "123e4567-e89b-12d3-a456-426614174002",
    responseType: "text",
    textResponse: "My draft answer",
    codeResponse: null,
    status: "draft",
    version: 1,
    finalizedAt: null,
    skippedAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  });

  beforeEach(() => {
    mockService = {
      startSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      completeSession: jest.fn(),
      listSessionAnswers: jest.fn(),
      getSessionAnswer: jest.fn(),
      saveDraftAnswer: jest.fn(),
      updateDraftAnswer: jest.fn(),
      finalizeAnswer: jest.fn(),
    };

    req = {
      params: {
        interviewId: "123e4567-e89b-12d3-a456-426614174000",
        sessionId: "123e4567-e89b-12d3-a456-426614174001",
        sessionQuestionId: "123e4567-e89b-12d3-a456-426614174002",
      },
      body: {},
      get: jest.fn().mockReturnValue("idempotency-123") as any,
      context: { requestId: "req-1" } as any,
    };

    res = {
      locals: { interviewsService: mockService },
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
      setHeader: jest.fn() as any,
    };

    controller = createInterviewsController();
  });

  // ============================================================
  // Phase 5: Lifecycle Methods
  // ============================================================

  const lifecycleMethods = [
    { name: "startSession", action: "startSession" },
    { name: "pauseSession", action: "pauseSession" },
    { name: "resumeSession", action: "resumeSession" },
    { name: "completeSession", action: "completeSession" },
  ] as const;

  for (const { name, action } of lifecycleMethods) {
    describe(name, () => {
      it("should return success and set replay header if replayed", async () => {
        mockService[action].mockResolvedValue({
          replayed: true,
          snapshot: createValidSessionSnapshot(),
        });

        const next = jest.fn();
        await controller[name](req as Request, res as Response, next);

        expect(res.setHeader).toHaveBeenCalledWith("X-Idempotency-Replay", "true");
        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            meta: expect.objectContaining({ requestId: "req-1" }),
          }),
        );
        expect(next).not.toHaveBeenCalled();
      });

      it("should not set replay header if not replayed", async () => {
        mockService[action].mockResolvedValue({
          replayed: false,
          snapshot: createValidSessionSnapshot(),
        });

        const next = jest.fn();
        await controller[name](req as Request, res as Response, next);

        expect(res.setHeader).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
        expect(next).not.toHaveBeenCalled();
      });

      it("should call next with error if idempotency header is missing", async () => {
        const next = jest.fn();
        req.get = jest.fn().mockReturnValue(undefined) as any;

        await controller[name](req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if body has unknown field", async () => {
        const next = jest.fn();
        req.body = { unknown: "field" };

        await controller[name](req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if body is not an object", async () => {
        const next = jest.fn();
        req.body = "string";

        await controller[name](req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if path UUID is invalid", async () => {
        const next = jest.fn();
        req.params!.interviewId = "invalid-uuid";

        await controller[name](req as Request, res as Response, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  }

  // ============================================================
  // Phase 6.3: Answer Mutations & Reads
  // ============================================================

  describe("listSessionAnswers", () => {
    it("should call service and return mapped response", async () => {
      const answers = [createValidAnswerSnapshot()];
      mockService.listSessionAnswers.mockResolvedValue(answers);
      const next = jest.fn();
      req.get = jest.fn().mockReturnValue(undefined) as any;

      await controller.listSessionAnswers(req as Request, res as Response, next);

      expect(mockService.listSessionAnswers).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
      );
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: [
            expect.objectContaining({
              id: "123e4567-e89b-12d3-a456-426614174003",
              status: "draft",
            }),
          ],
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with error if path UUID is invalid", async () => {
      const next = jest.fn();
      req.params!.sessionId = "invalid-uuid";

      await controller.listSessionAnswers(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(mockService.listSessionAnswers).not.toHaveBeenCalled();
    });

    it("should forward service failures to next", async () => {
      const next = jest.fn();
      mockService.listSessionAnswers.mockRejectedValue(new Error("Service Error"));

      await controller.listSessionAnswers(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("getSessionAnswer", () => {
    it("should call service and return mapped response", async () => {
      const answer = createValidAnswerSnapshot();
      mockService.getSessionAnswer.mockResolvedValue(answer);
      const next = jest.fn();
      req.get = jest.fn().mockReturnValue(undefined) as any;

      await controller.getSessionAnswer(req as Request, res as Response, next);

      expect(mockService.getSessionAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
      );
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ id: "123e4567-e89b-12d3-a456-426614174003" }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should call next with error if path UUID is invalid", async () => {
      const next = jest.fn();
      req.params!.sessionQuestionId = "invalid-uuid";

      await controller.getSessionAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(mockService.getSessionAnswer).not.toHaveBeenCalled();
    });

    it("should forward service failures to next", async () => {
      const next = jest.fn();
      mockService.getSessionAnswer.mockRejectedValue(new Error("Service Error"));

      await controller.getSessionAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("saveDraftAnswer", () => {
    it("should process a valid text answer correctly", async () => {
      req.body = { responseType: "text", textResponse: "Some answer" };
      mockService.saveDraftAnswer.mockResolvedValue({
        replayed: false,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.saveDraftAnswer(req as Request, res as Response, next);

      expect(mockService.saveDraftAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        { responseType: "text", textResponse: "Some answer" },
        "idempotency-123",
      );
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should process a valid code answer correctly and set replay header if replayed", async () => {
      req.body = {
        responseType: "code",
        codeResponse: { source: "console.log(1)", language: "typescript", explanation: "Log" },
      };
      mockService.saveDraftAnswer.mockResolvedValue({
        replayed: true,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.saveDraftAnswer(req as Request, res as Response, next);

      expect(mockService.saveDraftAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        {
          responseType: "code",
          codeResponse: { source: "console.log(1)", language: "typescript", explanation: "Log" },
        },
        "idempotency-123",
      );
      expect(res.setHeader).toHaveBeenCalledWith("X-Idempotency-Replay", "true");
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward missing idempotency key error to next", async () => {
      req.get = jest.fn().mockReturnValue(undefined) as any;
      const next = jest.fn();

      await controller.saveDraftAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should forward invalid body error to next (unknown fields)", async () => {
      req.body = { responseType: "text", textResponse: "Ans", unknown: "field" };
      const next = jest.fn();

      await controller.saveDraftAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should forward service failure to next", async () => {
      req.body = { responseType: "text", textResponse: "Ans" };
      mockService.saveDraftAnswer.mockRejectedValue(new Error("Service Error"));
      const next = jest.fn();

      await controller.saveDraftAnswer(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("updateDraftAnswer", () => {
    it("should process a valid text update correctly", async () => {
      req.body = { responseType: "text", textResponse: "Updated answer", expectedVersion: 1 };
      mockService.updateDraftAnswer.mockResolvedValue({
        replayed: false,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.updateDraftAnswer(req as Request, res as Response, next);

      expect(mockService.updateDraftAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        { responseType: "text", textResponse: "Updated answer", expectedVersion: 1 },
        "idempotency-123",
      );
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should process a valid code update and set replay header if replayed", async () => {
      req.body = {
        responseType: "code",
        codeResponse: { source: "console.log(2)", language: "typescript", explanation: "Log" },
        expectedVersion: 2,
      };
      mockService.updateDraftAnswer.mockResolvedValue({
        replayed: true,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.updateDraftAnswer(req as Request, res as Response, next);

      expect(mockService.updateDraftAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        {
          responseType: "code",
          codeResponse: { source: "console.log(2)", language: "typescript", explanation: "Log" },
          expectedVersion: 2,
        },
        "idempotency-123",
      );
      expect(res.setHeader).toHaveBeenCalledWith("X-Idempotency-Replay", "true");
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(next).not.toHaveBeenCalled();
    });

    it("should require Idempotency-Key", async () => {
      req.get = jest.fn().mockReturnValue(undefined) as any;
      const next = jest.fn();
      await controller.updateDraftAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject invalid expectedVersion", async () => {
      req.body = { responseType: "text", textResponse: "Updated", expectedVersion: -1 };
      const next = jest.fn();
      await controller.updateDraftAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject unknown fields", async () => {
      req.body = { responseType: "text", textResponse: "Updated", expectedVersion: 1, extra: 123 };
      const next = jest.fn();
      await controller.updateDraftAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should forward service failures", async () => {
      req.body = { responseType: "text", textResponse: "Updated", expectedVersion: 1 };
      mockService.updateDraftAnswer.mockRejectedValue(new Error("Service Error"));
      const next = jest.fn();
      await controller.updateDraftAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("finalizeAnswer", () => {
    it("should finalize correctly with valid expectedVersion", async () => {
      req.body = { expectedVersion: 2 };
      mockService.finalizeAnswer.mockResolvedValue({
        replayed: false,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.finalizeAnswer(req as Request, res as Response, next);

      expect(mockService.finalizeAnswer).toHaveBeenCalledWith(
        "123e4567-e89b-12d3-a456-426614174000",
        "123e4567-e89b-12d3-a456-426614174001",
        "123e4567-e89b-12d3-a456-426614174002",
        { expectedVersion: 2 },
        "idempotency-123",
      );
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: expect.any(Object) }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should set replay header if replayed", async () => {
      req.body = { expectedVersion: 2 };
      mockService.finalizeAnswer.mockResolvedValue({
        replayed: true,
        snapshot: createValidAnswerSnapshot(),
      });
      const next = jest.fn();

      await controller.finalizeAnswer(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith("X-Idempotency-Replay", "true");
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    });

    it("should require Idempotency-Key", async () => {
      req.get = jest.fn().mockReturnValue(undefined) as any;
      const next = jest.fn();
      await controller.finalizeAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject missing/invalid expectedVersion", async () => {
      req.body = {}; // missing expectedVersion
      const next = jest.fn();
      await controller.finalizeAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));

      req.body = { expectedVersion: "string" };
      await controller.finalizeAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should reject unknown fields", async () => {
      req.body = { expectedVersion: 2, unknownField: true };
      const next = jest.fn();
      await controller.finalizeAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should forward service failures", async () => {
      req.body = { expectedVersion: 2 };
      mockService.finalizeAnswer.mockRejectedValue(new Error("Service Error"));
      const next = jest.fn();
      await controller.finalizeAnswer(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
