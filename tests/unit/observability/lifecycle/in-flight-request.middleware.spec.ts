import { jest } from "@jest/globals";
import { createInFlightRequestMiddleware } from "../../../../src/observability/lifecycle/in-flight-request.middleware.js";
import {
  createInFlightRequestTracker,
  type InFlightRequestTracker,
} from "../../../../src/observability/lifecycle/in-flight-request-tracker.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import EventEmitter from "node:events";
import type { Request, Response } from "express";

describe("In-Flight Request Middleware", () => {
  let mockLogger: jest.Mocked<ApplicationLogger>;
  let tracker: InFlightRequestTracker;

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
    tracker = createInFlightRequestTracker();
  });

  it("increments and decrements on finish", () => {
    const middleware = createInFlightRequestMiddleware({ tracker });

    const req = new EventEmitter() as Request;
    const res = new EventEmitter() as Response;
    const next = jest.fn();

    middleware(req, res, next);

    expect(tracker.getCount()).toBe(1);
    expect(next).toHaveBeenCalled();

    res.emit("finish");
    expect(tracker.getCount()).toBe(0);
  });

  it("increments and decrements on close, preventing double decrement", () => {
    const middleware = createInFlightRequestMiddleware({ tracker });

    const req = new EventEmitter() as Request;
    const res = new EventEmitter() as Response;
    const next = jest.fn();

    middleware(req, res, next);
    expect(tracker.getCount()).toBe(1);

    req.emit("close");
    expect(tracker.getCount()).toBe(0);

    res.emit("finish");
    expect(tracker.getCount()).toBe(0);
  });
});
