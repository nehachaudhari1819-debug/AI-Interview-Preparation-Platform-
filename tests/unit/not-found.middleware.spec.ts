import { jest } from "@jest/globals";
import type { Request, Response } from "express";

import { notFoundMiddleware } from "../../src/middleware/not-found.middleware.js";
import { NotFoundError } from "../../src/errors/not-found.error.js";

describe("notFoundMiddleware", () => {
  it("forwards a NotFoundError", () => {
    const mockRequest = { method: "GET", originalUrl: "/api/unknown" } as Request;
    const mockResponse = {} as Response;
    const nextFunction = jest.fn((error?: unknown): void => {
      void error;
    });

    notFoundMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledTimes(1);
    expect(nextFunction).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});
