import { jest } from "@jest/globals";
import type { Request, Response } from "express";

import { errorHandlerMiddleware } from "../../src/middleware/error-handler.middleware.js";
import { AppError } from "../../src/errors/app-error.js";
import { ERROR_CODES } from "../../src/constants/error-codes.constants.js";
import { HTTP_STATUS } from "../../src/constants/http.constants.js";

describe("errorHandlerMiddleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    mockRequest = { context: { requestId: "req-123" } };
    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis() as unknown as Response["status"],
      json: jest.fn() as unknown as Response["json"],
    };
    nextFunction = jest.fn();
    originalConsoleError = console.error;
    console.error = jest.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("handles known AppError properly", () => {
    const error = new AppError({
      statusCode: 400,
      code: "TEST_CODE",
      message: "Test message",
    });

    errorHandlerMiddleware(error, mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: "Test message",
      code: "TEST_CODE",
      meta: { requestId: "req-123" },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("converts unknown errors to 500 INTERNAL_SERVER_ERROR", () => {
    const error = new Error("Unknown failure");

    errorHandlerMiddleware(error, mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: false,
      message: "An unexpected error occurred.",
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      meta: { requestId: "req-123" },
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("maps body parser entity.too.large to PAYLOAD_TOO_LARGE", () => {
    const error = new Error("Payload too large");
    (error as Error & { type: string }).type = "entity.too.large";

    errorHandlerMiddleware(error, mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.PAYLOAD_TOO_LARGE);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERROR_CODES.PAYLOAD_TOO_LARGE }),
    );
  });

  it("delegates to next if headers are sent", () => {
    mockResponse.headersSent = true;
    const error = new Error("Too late");

    errorHandlerMiddleware(error, mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(error);
    expect(mockResponse.status).not.toHaveBeenCalled();
  });
});
