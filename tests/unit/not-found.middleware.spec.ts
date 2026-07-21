import type { NextFunction, Request, Response } from "express";

import { notFoundMiddleware } from "../../src/middleware/not-found.middleware.js";
import { NotFoundError } from "../../src/errors/not-found.error.js";

describe("notFoundMiddleware", () => {
  it("forwards a NotFoundError", () => {
    const mockRequest = { method: "GET", originalUrl: "/api/unknown" } as Request;
    const mockResponse = {} as Response;
    const nextFunction = jest.fn() as NextFunction;

    notFoundMiddleware(mockRequest, mockResponse, nextFunction);

    expect(nextFunction).toHaveBeenCalledTimes(1);
    const error = nextFunction.mock.calls[0][0] as Error;
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Route GET /api/unknown was not found.");
  });
});
