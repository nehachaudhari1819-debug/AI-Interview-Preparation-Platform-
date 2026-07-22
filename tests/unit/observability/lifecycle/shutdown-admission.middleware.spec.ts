import { jest } from "@jest/globals";
import { createShutdownAdmissionMiddleware } from "../../../../src/observability/lifecycle/shutdown-admission.middleware.js";
import {
  createApplicationLifecycle,
  type ApplicationLifecycle,
} from "../../../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import type { Request, Response } from "express";
import { ServiceUnavailableError } from "../../../../src/errors/service-unavailable.error.js";

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
      child: jest.fn() as any,
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
    const res = {} as Response;
    const next = jest.fn();

    middleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);

    const firstCall = next.mock.calls.at(0);

    if (!firstCall) {
      throw new Error("Expected next middleware callback to be called.");
    }

    const errorArg: unknown = firstCall[0];

    expect(errorArg).toBeInstanceOf(ServiceUnavailableError);

    if (!(errorArg instanceof ServiceUnavailableError)) {
      throw new Error("Expected a ServiceUnavailableError.");
    }

    expect(errorArg.name).toBe("ServiceUnavailableError");
    expect(errorArg.statusCode).toBe(503);
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
