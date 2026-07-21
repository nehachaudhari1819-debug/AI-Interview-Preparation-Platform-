import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createHelmetMiddleware } from "../../../src/security/create-helmet-middleware.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";

describe("createHelmetMiddleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;

  beforeEach(() => {
    req = {};
    res = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
    } as unknown as Response;
    next = jest.fn();
  });

  it("applies HSTS headers when enabled in config", () => {
    const config = createTestApplicationConfig({
      security: {
        ...createTestApplicationConfig().security,
        helmet: { enableHsts: true },
      },
    });

    const middleware = createHelmetMiddleware(config);
    middleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
    expect(next).toHaveBeenCalled();
  });

  it("omits HSTS headers when disabled in config", () => {
    const config = createTestApplicationConfig();
    const middleware = createHelmetMiddleware(config);
    middleware(req as Request, res as Response, next);

    expect(res.setHeader).not.toHaveBeenCalledWith("Strict-Transport-Security", expect.any(String));
  });
});
