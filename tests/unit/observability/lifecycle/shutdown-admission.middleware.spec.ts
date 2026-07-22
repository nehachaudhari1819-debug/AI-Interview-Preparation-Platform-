import { jest } from "@jest/globals";
import { createShutdownAdmissionMiddleware } from "../../../../src/observability/lifecycle/shutdown-admission.middleware.js";
import {
  createApplicationLifecycle,
  type ApplicationLifecycle,
} from "../../../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import type { Request, Response } from "express";

describe("Shutdown Admission Middleware", () => {
  let mockLogger: jest.Mocked<ApplicationLogger>;
  let lifecycle: ApplicationLifecycle;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn().mockReturnThis(),
      flush: jest.fn(),
    };
    lifecycle = createApplicationLifecycle();
  });

  it("admits requests when ready", () => {
    lifecycle.markReady();
    const middleware = createShutdownAdmissionMiddleware({ lifecycle });

    const req = { originalUrl: "/api/test" } as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("rejects requests when shutting down (except health)", () => {
    lifecycle.markReady();
    lifecycle.beginShutdown("test");

    const middleware = createShutdownAdmissionMiddleware({ lifecycle });

    const req = { originalUrl: "/api/test" } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalled();
  });

  it("admits /health endpoints even when shutting down", () => {
    lifecycle.markReady();
    lifecycle.beginShutdown("test");

    const middleware = createShutdownAdmissionMiddleware({ lifecycle });

    const req = { originalUrl: "/health/live" } as Request;
    const res = {} as Response;
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
