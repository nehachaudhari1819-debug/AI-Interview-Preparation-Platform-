import { jest } from "@jest/globals";
import { apiMethodGuard } from "../../../../src/security/request-boundaries/api-method-guard.middleware.js";
import { MethodNotAllowedError } from "../../../../src/errors/method-not-allowed.error.js";
import type { Request, Response, NextFunction } from "express";

describe("apiMethodGuard", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn() as unknown as Response["setHeader"],
    };
    next = jest.fn();
  });

  it("should allow GET method", () => {
    req.method = "GET";
    apiMethodGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject TRACE method", () => {
    req.method = "TRACE";
    apiMethodGuard(req as Request, res as Response, next);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Allow",
      "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    expect(next).toHaveBeenCalledWith(expect.any(MethodNotAllowedError));
  });
});
