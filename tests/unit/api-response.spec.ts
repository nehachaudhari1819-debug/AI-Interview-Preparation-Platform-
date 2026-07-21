import { sendCollection, sendSuccess } from "../../src/utils/api-response.js";

import type { Response } from "express";

describe("API Response Utilities", () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("sendSuccess sends a proper success envelope", () => {
    sendSuccess({
      response: mockResponse as Response,
      statusCode: 200,
      data: { id: 1 },
      requestId: "req-123",
      message: "Success",
    });

    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      message: "Success",
      data: { id: 1 },
      meta: { requestId: "req-123" },
    });
  });

  it("sendSuccess omits message if undefined", () => {
    sendSuccess({
      response: mockResponse as Response,
      statusCode: 201,
      data: { id: 2 },
      requestId: "req-456",
    });

    expect(mockResponse.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 2 },
      meta: { requestId: "req-456" },
    });
  });

  it("sendCollection includes pagination", () => {
    sendCollection({
      response: mockResponse as Response,
      statusCode: 200,
      data: [{ id: 1 }],
      requestId: "req-789",
      pagination: {
        page: 1,
        limit: 10,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: [{ id: 1 }],
        pagination: {
          page: 1,
          limit: 10,
          totalItems: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    );
  });
});
