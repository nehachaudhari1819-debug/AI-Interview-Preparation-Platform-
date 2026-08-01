import { describe, expect, it, beforeEach, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createInterviewsController } from "../../../../src/features/interviews/interviews.controller.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";

describe("InterviewsController Lifecycle Methods", () => {
  let mockService: any;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let controller: ReturnType<typeof createInterviewsController>;

  beforeEach(() => {
    mockService = {
      startSession: jest.fn(),
      pauseSession: jest.fn(),
      resumeSession: jest.fn(),
      completeSession: jest.fn(),
    };

    req = {
      params: {
        interviewId: "123e4567-e89b-12d3-a456-426614174000",
        sessionId: "123e4567-e89b-12d3-a456-426614174001",
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

  const methods = [
    { name: "startSession", action: "startSession" },
    { name: "pauseSession", action: "pauseSession" },
    { name: "resumeSession", action: "resumeSession" },
    { name: "completeSession", action: "completeSession" },
  ];

  for (const { name, action } of methods) {
    describe(name, () => {
      it("should return success and set replay header if replayed", async () => {
        mockService[action].mockResolvedValue({
          replayed: true,
          snapshot: {
            id: "123e4567-e89b-12d3-a456-426614174001",
            interview_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174002",
            status: "in_progress",
            started_at: new Date().toISOString(),
            paused_at: null,
            total_paused_seconds: 0,
            completed_at: null,
            last_transition_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            config_snapshot_version: 1,
            config_snapshot: {
              title: "Test",
              targetRole: "Dev",
              questionCount: 3,
              timeLimitMinutes: 30,
              interviewType: { id: "type-1", name: "Type" },
              difficulty: { id: "diff-1", name: "Diff" },
              skills: [{ id: "skill-1", name: "Skill" }],
              topics: [{ id: "topic-1", name: "Topic" }],
            },
          },
        });

        const next = jest.fn();
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);

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
          snapshot: {
            id: "123e4567-e89b-12d3-a456-426614174001",
            interview_id: "123e4567-e89b-12d3-a456-426614174000",
            user_id: "123e4567-e89b-12d3-a456-426614174002",
            status: "in_progress",
            started_at: new Date().toISOString(),
            paused_at: null,
            total_paused_seconds: 0,
            completed_at: null,
            last_transition_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            config_snapshot_version: 1,
            config_snapshot: {
              title: "Test",
              targetRole: "Dev",
              questionCount: 3,
              timeLimitMinutes: 30,
              interviewType: { id: "type-1", name: "Type" },
              difficulty: { id: "diff-1", name: "Diff" },
              skills: [{ id: "skill-1", name: "Skill" }],
              topics: [{ id: "topic-1", name: "Topic" }],
            },
          },
        });

        const next = jest.fn();
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);

        expect(res.setHeader).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
        expect(next).not.toHaveBeenCalled();
      });

      it("should call next with error if idempotency header is missing", async () => {
        const next = jest.fn();
        req.get = jest.fn().mockReturnValue(undefined) as any;
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if body has unknown field", async () => {
        const next = jest.fn();
        req.body = { unknown: "field" };
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if body is not an object", async () => {
        const next = jest.fn();
        req.body = "string";
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });

      it("should call next with error if path UUID is invalid", async () => {
        const next = jest.fn();
        req.params!.interviewId = "invalid-uuid";
        await controller[
          name as "startSession" | "pauseSession" | "resumeSession" | "completeSession"
        ](req as Request, res as Response, next);
        expect(next).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  }
});
