import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { withIdempotency } from "../../../src/middleware/idempotency.middleware.js";
import type { createSupabaseIdempotencyRepository } from "../../../src/persistence/system/idempotency.repository.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

/**
 * Builds a minimal mock of the idempotency persistence repository.
 */
function buildMockRepo() {
  return {
    tryAcquire: jest.fn<any>(),
    complete: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    fail: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
  };
}

describe("Idempotency Wrapper", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockRepo: ReturnType<typeof buildMockRepo>;
  let mockRepoFactory: jest.Mock<typeof createSupabaseIdempotencyRepository>;
  const mockConfig = {} as ApplicationConfig;
  let mockHandler: jest.Mock<any>;

  const baseOptions = {
    operation: "test_op",
    routePattern: "/test",
    apiVersion: "v1",
  };

  beforeEach(() => {
    mockRepo = buildMockRepo();
    mockRepoFactory = jest
      .fn<typeof createSupabaseIdempotencyRepository>()
      .mockReturnValue(mockRepo);

    mockRequest = {
      method: "POST",
      headers: {
        "idempotency-key": "valid-key-123",
      },
      originalUrl: "/api/v1/test",
      body: { foo: "bar" },
      context: {
        authentication: {
          state: "authenticated",
          principal: { userId: "user-123" } as any,
        },
      },
    } as any;

    mockResponse = {
      statusCode: 200,
      locals: {},
      json: jest.fn<any>().mockReturnThis(),
      status: jest.fn<any>().mockReturnThis(),
      send: jest.fn<any>().mockReturnThis(),
    } as any;

    nextFunction = jest.fn();

    mockHandler = jest.fn<any>().mockResolvedValue({ status: 200, body: { success: true } });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Authentication guard
  // ---------------------------------------------------------------------------

  it("returns 401 if unauthenticated", async () => {
    mockRequest.context!.authentication = { state: "anonymous" };
    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(mockHandler).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Key validation
  // ---------------------------------------------------------------------------

  it("returns 400 IDEMPOTENCY_KEY_REQUIRED if key is missing", async () => {
    delete mockRequest.headers!["idempotency-key"];
    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: "IDEMPOTENCY_KEY_REQUIRED" }),
    );
  });

  // ---------------------------------------------------------------------------
  // Acquisition states
  // ---------------------------------------------------------------------------

  it("returns 409 IDEMPOTENCY_CONFLICT if tryAcquire returns conflict", async () => {
    mockRepo.tryAcquire.mockResolvedValue({ status: "conflict" });
    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 409, code: "IDEMPOTENCY_CONFLICT" }),
    );
  });

  it("returns cached response if tryAcquire returns replay", async () => {
    mockRepo.tryAcquire.mockResolvedValue({
      status: "replay",
      responseStatus: 201,
      responseBody: JSON.stringify({ success: true }),
    });
    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    expect(mockHandler).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Acquired: completion is awaited before response
  // ---------------------------------------------------------------------------

  it("executes handler, awaits completion, and sends response when acquired", async () => {
    mockRepo.tryAcquire.mockResolvedValue({
      status: "acquired",
      recordId: "rec-id-1",
      leaseToken: "token-1",
      leaseExpiresAt: new Date().toISOString(),
    });

    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockHandler).toHaveBeenCalled();
    expect(mockRepo.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: "rec-id-1",
        leaseToken: "token-1",
        responseStatus: 200,
        responseBody: { success: true },
      }),
    );
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
  });

  it("calls fail if handler throws", async () => {
    mockRepo.tryAcquire.mockResolvedValue({
      status: "acquired",
      recordId: "rec-id-2",
      leaseToken: "token-2",
      leaseExpiresAt: new Date().toISOString(),
    });

    const testError = new Error("Handler failed");
    mockHandler.mockRejectedValue(testError);

    const wrapper = withIdempotency(mockConfig, baseOptions, mockHandler, mockRepoFactory);

    await wrapper(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith(testError);
    expect(mockRepo.fail).toHaveBeenCalledWith({ recordId: "rec-id-2", leaseToken: "token-2" });
    expect(mockRepo.complete).not.toHaveBeenCalled();
  });
});
