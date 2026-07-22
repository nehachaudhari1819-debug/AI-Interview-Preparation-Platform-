import { jest } from "@jest/globals";
import { createApiRequestTargetGuard } from "../../../../src/security/request-boundaries/api-request-target-guard.middleware.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";
import { UriTooLongError } from "../../../../src/errors/uri-too-long.error.js";
import { TooManyQueryParametersError } from "../../../../src/errors/too-many-query-parameters.error.js";
import type { Request, Response, NextFunction } from "express";

describe("createApiRequestTargetGuard", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const config = createTestApplicationConfig();
  const guard = createApiRequestTargetGuard(config);

  beforeEach(() => {
    req = { originalUrl: "/api/v1/test" };
    res = {};
    next = jest.fn();
  });

  it("should allow valid short url", () => {
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject long url", () => {
    req.originalUrl = "/api/v1/" + "a".repeat(2500);
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UriTooLongError));
  });

  it("should reject too many query parameters", () => {
    req.originalUrl =
      "/api/v1/test?" +
      Array.from({ length: 60 })
        .map((_, i) => `q${String(i)}=1`)
        .join("&");
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(TooManyQueryParametersError));
  });
});
