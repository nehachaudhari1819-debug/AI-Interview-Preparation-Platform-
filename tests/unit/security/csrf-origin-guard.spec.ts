import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createCsrfOriginGuard } from "../../../src/security/csrf-origin-guard.middleware.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";
import { CsrfOriginError } from "../../../src/errors/csrf-origin.error.js";

describe("createCsrfOriginGuard", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  const config = createTestApplicationConfig({
    security: {
      ...createTestApplicationConfig().security,
      cors: {
        ...createTestApplicationConfig().security.cors,
        allowedOrigins: ["https://app.example.com"],
      },
    },
  });
  const middleware = createCsrfOriginGuard(config);

  beforeEach(() => {
    req = {
      method: "POST",
      headers: {},
      context: { security: {} } as unknown as Request["context"],
    };
    res = {};
    next = jest.fn();
  });

  it("allows SAFE methods", () => {
    req.method = "GET";
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks cross-site fetchSite", () => {
    req = {
      method: "POST",
      headers: {},
      context: { security: { fetchSite: "cross-site" } } as unknown as Request["context"],
    };
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(CsrfOriginError));
  });

  it("allows trusted origin", () => {
    req = {
      method: "POST",
      headers: {},
      context: { security: { origin: "https://app.example.com" } } as unknown as Request["context"],
    };
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks untrusted origin", () => {
    req = {
      method: "POST",
      headers: {},
      context: { security: { origin: "https://malicious.com" } } as unknown as Request["context"],
    };
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(CsrfOriginError));
  });

  it("falls back to referer if origin is missing", () => {
    req = {
      method: "POST",
      headers: { referer: "https://app.example.com/some/path" },
      context: { security: {} } as unknown as Request["context"],
    };
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("blocks if origin and referer are both missing on unsafe method", () => {
    middleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.any(CsrfOriginError));
  });
});
