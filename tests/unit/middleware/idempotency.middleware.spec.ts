import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { createIdempotencyMiddleware } from "../../../src/middleware/idempotency.middleware.js";
import * as idempotencyRepoModule from "../../../src/persistence/system/idempotency.repository.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

describe("Idempotency Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockRepo: { tryAcquire: jest.Mock<any>; complete: jest.Mock<any> };
  const mockConfig = {} as ApplicationConfig;

  beforeEach(() => {
    mockRepo = {
      tryAcquire: jest.fn(),
      complete: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    jest
      .spyOn(idempotencyRepoModule, "createSupabaseIdempotencyRepository")
      .mockReturnValue(mockRepo);

    mockRequest = {
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

    let finishCallback: (() => void) | undefined;
    mockResponse = {
      statusCode: 200,
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      on: jest.fn<any>().mockImplementation((event: any, cb: any) => {
        if (event === "finish") finishCallback = cb;
        return mockResponse;
      }),
    } as any;

    (mockResponse as any).simulateFinish = () => {
      if (finishCallback) finishCallback();
    };

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it("returns 401 if unauthenticated", async () => {
    mockRequest.context!.authentication = { state: "anonymous" };
    const middleware = createIdempotencyMiddleware(mockConfig, { operation: "test" });

    await new Promise<void>((resolve) => {
      middleware(mockRequest as Request, mockResponse as Response, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(401);
        resolve();
      });
    });
  });

  it("returns 400 if idempotency key is missing", async () => {
    delete mockRequest.headers!["idempotency-key"];
    const middleware = createIdempotencyMiddleware(mockConfig, { operation: "test" });

    await new Promise<void>((resolve) => {
      middleware(mockRequest as Request, mockResponse as Response, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
        resolve();
      });
    });
  });

  it("returns 409 if tryAcquire returns conflict", async () => {
    mockRepo.tryAcquire.mockResolvedValue({ status: "conflict" });
    const middleware = createIdempotencyMiddleware(mockConfig, { operation: "test" });

    await new Promise<void>((resolve) => {
      middleware(mockRequest as Request, mockResponse as Response, (err) => {
        expect(err).toBeDefined();
        expect(err.statusCode).toBe(409);
        expect(err.code).toBe("IDEMPOTENCY_CONFLICT");
        resolve();
      });
    });
  });

  it("returns cached response if tryAcquire returns completed", async () => {
    mockRepo.tryAcquire.mockResolvedValue({
      status: "completed",
      responseStatus: 201,
      responseBody: JSON.stringify({ success: true }),
    });
    const middleware = createIdempotencyMiddleware(mockConfig, { operation: "test" });

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Give promises time to resolve
    await new Promise(process.nextTick);

    expect(mockResponse.status).toHaveBeenCalledWith(201);
    expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    expect(nextFunction).not.toHaveBeenCalled();
  });

  it("overrides res.json and completes on finish if tryAcquire returns processing", async () => {
    mockRepo.tryAcquire.mockResolvedValue({ status: "processing" });
    const middleware = createIdempotencyMiddleware(mockConfig, { operation: "test" });

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    await new Promise(process.nextTick);

    expect(nextFunction).toHaveBeenCalled();

    // Call the overridden res.json
    mockResponse.json!({ success: true });
    (mockResponse as any).simulateFinish();
    await new Promise(process.nextTick);

    expect(mockRepo.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        idempotencyKey: "valid-key-123",
        operation: "test",
        responseStatus: 200,
        responseBody: { success: true },
      }),
    );
  });
});
