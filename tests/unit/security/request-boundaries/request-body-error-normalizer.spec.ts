import { requestBodyErrorNormalizer } from "../../../../src/security/request-boundaries/request-body-error-normalizer.js";
import { PayloadTooLargeError } from "../../../../src/errors/payload-too-large.error.js";
import { MalformedJsonError } from "../../../../src/errors/malformed-json.error.js";
import { UnsupportedContentEncodingError } from "../../../../src/errors/unsupported-content-encoding.error.js";
import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";

describe("requestBodyErrorNormalizer", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {};
    next = jest.fn();
  });

  it("should map entity.too.large to PayloadTooLargeError", () => {
    requestBodyErrorNormalizer({ type: "entity.too.large" }, req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(PayloadTooLargeError));
  });

  it("should map entity.parse.failed to MalformedJsonError", () => {
    requestBodyErrorNormalizer(
      { type: "entity.parse.failed" },
      req as Request,
      res as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(MalformedJsonError));
  });

  it("should map encoding.unsupported to UnsupportedContentEncodingError", () => {
    requestBodyErrorNormalizer(
      { type: "encoding.unsupported" },
      req as Request,
      res as Response,
      next,
    );
    expect(next).toHaveBeenCalledWith(expect.any(UnsupportedContentEncodingError));
  });

  it("should pass through unknown errors", () => {
    const unknownError = new Error("unknown");
    requestBodyErrorNormalizer(unknownError, req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(unknownError);
  });
});
