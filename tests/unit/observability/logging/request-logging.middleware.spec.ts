import { jest } from "@jest/globals";
import { createRequestLoggingMiddleware } from "../../../../src/observability/logging/request-logging.middleware.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import EventEmitter from "node:events";
import type { Request, Response } from "express";

describe("Request Logging Middleware", () => {
  let mockLogger: jest.Mocked<ApplicationLogger>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn().mockImplementation(() => mockLogger) as any,
      flush: jest.fn(),
    };
  });

  it("logs completed requests", () => {
    const middleware = createRequestLoggingMiddleware({
      config: { observability: { logHealthRequests: false } } as any,
      logger: mockLogger,
    });

    const req = new EventEmitter() as Request;
    (req as any).path = "/api/test";
    (req as any).context = { requestId: "req-123" };

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 200;

    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit("finish");

    expect(mockLogger.info).toHaveBeenCalled();
    const callArgs = (mockLogger.info as any).mock.calls[0];
    expect(callArgs[0].event).toBe("http.request.completed");
  });

  it("logs aborted requests and ignores subsequent finish", () => {
    const middleware = createRequestLoggingMiddleware({
      config: { observability: { logHealthRequests: false } } as any,
      logger: mockLogger,
    });

    const req = new EventEmitter() as Request;
    (req as any).path = "/api/test";
    (req as any).context = { requestId: "req-456" };

    const res = new EventEmitter() as Response;

    const next = jest.fn();

    middleware(req, res, next);

    res.emit("close");

    expect(mockLogger.warn).toHaveBeenCalled();
    const callArgs = (mockLogger.warn as any).mock.calls[0];
    expect(callArgs[0].event).toBe("http.request.aborted");

    // ensure finish after close does not log again
    res.emit("finish");
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
