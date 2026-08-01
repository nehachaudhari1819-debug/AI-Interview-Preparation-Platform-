import { describe, expect, it, jest, afterEach } from "@jest/globals";
import express from "express";
import request from "supertest";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";
import { AppError } from "../../../../src/errors/app-error.js";
import { ERROR_CODES } from "../../../../src/constants/error-codes.constants.js";
import type { Request, Response, NextFunction } from "express";

describe("InterviewsRouter", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("should enforce application-level idempotency on POST /interviews", async () => {
    let capturedOpts: any;

    const mockCreateInterviewHandler = jest.fn((req: any, res: any) =>
      res.status(201).json({ success: true }),
    );

    const withIdempotencyMock = jest.fn((config: any, opts: any, handler: any) => {
      capturedOpts = opts;
      return (req: Request, res: Response, next: NextFunction) => {
        if (!req.headers["idempotency-key"]) {
          next(
            new AppError({
              statusCode: HTTP_STATUS.BAD_REQUEST,
              code: "IDEMPOTENCY_KEY_REQUIRED",
              message: "Missing idempotency key",
            }),
          );
          return;
        }
        handler(req, res, next);
      };
    });

    jest.unstable_mockModule("../../../../src/middleware/idempotency.middleware.js", () => {
      return { withIdempotency: withIdempotencyMock };
    });

    jest.unstable_mockModule("../../../../src/features/interviews/interviews.controller.js", () => {
      return {
        createInterviewsController: () => ({
          createInterviewHandler: mockCreateInterviewHandler,
          getInterviews: jest.fn(),
          getInterviewById: jest.fn(),
          updateInterviewHandler: jest.fn(),
          createSession: jest.fn(),
          getInterviewSessions: jest.fn(),
          getInterviewSessionById: jest.fn(),
          getSessionQuestions: jest.fn(),
          getSessionQuestionById: jest.fn(),
          startSession: jest.fn(),
          pauseSession: jest.fn(),
          resumeSession: jest.fn(),
          completeSession: jest.fn(),
        }),
      };
    });

    const { createInterviewsRouter: routerFactory } =
      await import("../../../../src/features/interviews/interviews.router.js");

    const app = express();
    app.use(express.json());

    const noopMiddleware = (req: any, res: any, next: any) => next();

    app.use(
      "/api/v1/interviews",
      routerFactory({
        config: {} as any,
        authMiddleware: noopMiddleware,
        activeAccountMiddleware: noopMiddleware,
        serviceMiddleware: noopMiddleware,
      }),
    );

    // Test error handler
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      res.status(err.statusCode || 500).json({ code: err.code, message: err.message });
    });

    // Test 1: Missing Key Request
    const resMissing = await request(app).post("/api/v1/interviews").send({ title: "Test" });

    expect(resMissing.status).toBe(400);
    expect(resMissing.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(mockCreateInterviewHandler).not.toHaveBeenCalled();

    // Test 2: Valid Request
    const resValid = await request(app)
      .post("/api/v1/interviews")
      .set("Idempotency-Key", "idem-test-key")
      .send({ title: "Test" });

    expect(resValid.status).toBe(201);
    expect(mockCreateInterviewHandler).toHaveBeenCalledTimes(1);

    expect(withIdempotencyMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        apiVersion: "v1",
        operation: "INTERVIEWS_CREATE_INTERVIEW",
        routePattern: "/api/v1/interviews",
      }),
      expect.any(Function),
    );
  });
});
