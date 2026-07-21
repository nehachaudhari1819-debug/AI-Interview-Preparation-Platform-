import type { Request, Response } from "express";

import { requestIdMiddleware } from "../../src/middleware/request-id.middleware.js";

describe("requestIdMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      header: jest.fn().mockReturnValue(undefined),
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it("generates a new UUID when header is missing", () => {
    requestIdMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.context?.requestId).toBeDefined();
    expect(mockRequest.context?.requestId).toHaveLength(36);
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      "X-Request-ID",
      mockRequest.context?.requestId,
    );
    expect(nextFunction).toHaveBeenCalledTimes(1);
  });

  it("preserves a valid incoming UUID", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000";
    mockRequest.header = jest.fn().mockReturnValue(validUuid);

    requestIdMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.context?.requestId).toBe(validUuid);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Request-ID", validUuid);
  });

  it("replaces an invalid incoming request ID", () => {
    const invalidId = "not-a-uuid";
    mockRequest.header = jest.fn().mockReturnValue(invalidId);

    requestIdMiddleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest.context?.requestId).toBeDefined();
    expect(mockRequest.context?.requestId).not.toBe(invalidId);
  });
});
