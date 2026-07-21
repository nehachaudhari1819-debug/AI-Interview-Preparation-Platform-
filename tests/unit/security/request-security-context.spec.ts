import type { Request, Response, NextFunction } from "express";
import { requestSecurityContextMiddleware } from "../../../src/security/request-security-context.middleware.js";

describe("requestSecurityContextMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    req = {
      context: { requestId: "test-id" } as any,
      headers: {},
      ip: "127.0.0.1",
      protocol: "https",
      secure: true,
    };
    res = {};
    next = jest.fn();
  });

  it("populates security context safely", () => {
    requestSecurityContextMiddleware(req as Request, res as Response, next);
    expect(req.context?.security).toEqual({
      clientIp: "127.0.0.1",
      protocol: "https",
      isSecure: true,
      origin: undefined,
      fetchSite: undefined,
    });
    expect(next).toHaveBeenCalled();
  });

  it("extracts and normalizes valid origin", () => {
    req.headers!.origin = "https://example.com:443/";
    requestSecurityContextMiddleware(req as Request, res as Response, next);
    expect(req.context?.security.origin).toBe("https://example.com");
  });

  it("ignores invalid origin", () => {
    req.headers!.origin = "ftp://invalid.com";
    requestSecurityContextMiddleware(req as Request, res as Response, next);
    expect(req.context?.security.origin).toBeUndefined();
  });

  it("extracts valid sec-fetch-site", () => {
    req.headers!["sec-fetch-site"] = "same-origin";
    requestSecurityContextMiddleware(req as Request, res as Response, next);
    expect(req.context?.security.fetchSite).toBe("same-origin");
  });

  it("ignores invalid sec-fetch-site", () => {
    req.headers!["sec-fetch-site"] = "invalid-value";
    requestSecurityContextMiddleware(req as Request, res as Response, next);
    expect(req.context?.security.fetchSite).toBeUndefined();
  });
});
