import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import { createAuditMiddleware } from "../../../src/middleware/audit.middleware.js";
import type { createSupabaseAuditRepository } from "../../../src/persistence/system/audit.repository.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

describe("Audit Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockAuditRepo: { logEvent: jest.Mock<() => Promise<void>> };
  let mockRepoFactory: jest.Mock<typeof createSupabaseAuditRepository>;
  const mockConfig = {} as ApplicationConfig;

  beforeEach(() => {
    mockAuditRepo = { logEvent: jest.fn<() => Promise<void>>().mockResolvedValue(undefined) };
    mockRepoFactory = jest
      .fn<typeof createSupabaseAuditRepository>()
      .mockReturnValue(mockAuditRepo);

    mockRequest = {
      ip: "127.0.0.1",
      headers: {
        "user-agent": "test-agent",
      },
      context: {
        requestId: "test-req-123",
        authentication: {
          state: "authenticated",
          principal: { userId: "user-123" } as any,
        },
      },
    } as any;

    let finishCallback: (() => void) | undefined;
    mockResponse = {
      statusCode: 200,
      locals: {
        auditMetadata: { changedFields: ["fullName"] },
      },
      on: jest.fn<any>().mockImplementation((event: any, cb: any) => {
        if (event === "finish") {
          finishCallback = cb;
        }
        return mockResponse;
      }),
    } as any;

    // Helper to simulate request finish
    (mockResponse as any).simulateFinish = () => {
      if (finishCallback) finishCallback();
    };

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls next() without blocking", () => {
    const middleware = createAuditMiddleware(
      mockConfig,
      { action: "TEST_ACTION", resourceType: "test_resource" },
      mockRepoFactory,
    );

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(nextFunction).toHaveBeenCalled();
    expect(mockAuditRepo.logEvent).not.toHaveBeenCalled();
  });

  it("logs audit event successfully on response finish", async () => {
    const middleware = createAuditMiddleware(
      mockConfig,
      { action: "PROFILE_UPDATED", resourceType: "user" },
      mockRepoFactory,
    );

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);

    // Simulate request completing successfully
    (mockResponse as any).simulateFinish();

    // Since logEvent is not awaited by the middleware (it's backgrounded), we wait a microtask
    await new Promise(process.nextTick);

    expect(mockAuditRepo.logEvent).toHaveBeenCalledWith({
      action: "PROFILE_UPDATED",
      resourceType: "user",
      actorUserId: "user-123",
      resourceId: "user-123",
      metadata: { changedFields: ["fullName"] },
      requestId: "test-req-123",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
  });

  it("does not log audit event if response status is error", async () => {
    mockResponse.statusCode = 400;

    const middleware = createAuditMiddleware(
      mockConfig,
      { action: "TEST_ACTION", resourceType: "test_resource" },
      mockRepoFactory,
    );

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    (mockResponse as any).simulateFinish();
    await new Promise(process.nextTick);

    expect(mockAuditRepo.logEvent).not.toHaveBeenCalled();
  });

  it("handles unauthenticated requests gracefully", async () => {
    mockRequest.context!.authentication = { state: "anonymous" };

    const middleware = createAuditMiddleware(
      mockConfig,
      { action: "ANON_ACTION", resourceType: "anon_resource" },
      mockRepoFactory,
    );

    middleware(mockRequest as Request, mockResponse as Response, nextFunction);
    (mockResponse as any).simulateFinish();
    await new Promise(process.nextTick);

    expect(mockAuditRepo.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: null,
      }),
    );
  });
});
