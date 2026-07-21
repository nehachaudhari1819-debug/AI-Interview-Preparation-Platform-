import type { Request, Response, NextFunction } from "express";
import { createJsonContentTypeGuard } from "../../../src/security/content-type-guard.middleware.js";
import { UnsupportedMediaTypeError } from "../../../src/errors/unsupported-media-type.error.js";

describe("createJsonContentTypeGuard", () => {
  const guard = createJsonContentTypeGuard();
  
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    req = {
      method: "POST",
      headers: {},
    };
    res = {};
    next = jest.fn();
  });

  it("allows SAFE methods without checking body", () => {
    req.method = "GET";
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("allows POST with no content-length and no transfer-encoding", () => {
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks POST with body and missing content-type", () => {
    req.headers!["content-length"] = "10";
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError));
  });

  it("blocks POST with body and invalid content-type", () => {
    req.headers!["content-length"] = "10";
    req.headers!["content-type"] = "text/plain";
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnsupportedMediaTypeError));
  });

  it("allows POST with body and valid application/json", () => {
    req.headers!["content-length"] = "10";
    req.headers!["content-type"] = "application/json; charset=utf-8";
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });
});
