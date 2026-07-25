import { jest } from "@jest/globals";
import { IdempotencyService } from "../../../src/domain/idempotency/idempotency.service.js";
import type { IdempotencyDomainRepository } from "../../../src/domain/idempotency/idempotency.repository.js";
import type { IdempotencyAcquireResult } from "../../../src/domain/idempotency/idempotency.types.js";

function buildMockRepo(): jest.Mocked<IdempotencyDomainRepository> {
  return {
    acquire: jest.fn<() => Promise<IdempotencyAcquireResult>>(),
    complete: jest.fn<() => Promise<boolean>>(),
    fail: jest.fn<() => Promise<boolean>>(),
  };
}

const baseInput = {
  userId: "user-uuid-1",
  operation: "test_op",
  idempotencyKey: "key-abc",
  requestHash: "hash-abc",
  leaseDurationSec: 60,
};

const leaseContext = {
  recordId: "rec-1",
  leaseToken: "token-1",
  leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

describe("IdempotencyService", () => {
  let repo: jest.Mocked<IdempotencyDomainRepository>;
  let service: IdempotencyService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new IdempotencyService(repo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // acquire() — delegates to repository and returns result as-is
  // ---------------------------------------------------------------------------

  it("returns acquired when repository returns acquired", async () => {
    const result: IdempotencyAcquireResult = { status: "acquired", ...leaseContext };
    repo.acquire.mockResolvedValue(result);
    await expect(service.acquire(baseInput)).resolves.toEqual(result);
  });

  it("returns in_progress when repository returns in_progress", async () => {
    repo.acquire.mockResolvedValue({ status: "in_progress" });
    await expect(service.acquire(baseInput)).resolves.toEqual({ status: "in_progress" });
  });

  it("returns replay when repository returns replay", async () => {
    const result: IdempotencyAcquireResult = {
      status: "replay",
      responseStatus: 200,
      responseBody: { data: "cached" },
    };
    repo.acquire.mockResolvedValue(result);
    await expect(service.acquire(baseInput)).resolves.toEqual(result);
  });

  it("returns conflict when repository returns conflict", async () => {
    repo.acquire.mockResolvedValue({ status: "conflict" });
    await expect(service.acquire(baseInput)).resolves.toEqual({ status: "conflict" });
  });

  it("returns retryable_failed when repository returns retryable_failed", async () => {
    repo.acquire.mockResolvedValue({ status: "retryable_failed" });
    await expect(service.acquire(baseInput)).resolves.toEqual({ status: "retryable_failed" });
  });

  it("returns unavailable when repository returns unavailable", async () => {
    repo.acquire.mockResolvedValue({ status: "unavailable" });
    await expect(service.acquire(baseInput)).resolves.toEqual({ status: "unavailable" });
  });

  it("propagates repository errors from acquire()", async () => {
    repo.acquire.mockRejectedValue(new Error("DB connection failed"));
    await expect(service.acquire(baseInput)).rejects.toThrow("DB connection failed");
  });

  // ---------------------------------------------------------------------------
  // complete()
  // ---------------------------------------------------------------------------

  it("returns true when complete() succeeds", async () => {
    repo.complete.mockResolvedValue(true);
    await expect(
      service.complete({
        recordId: "rec-1",
        leaseToken: "token-1",
        responseStatus: 200,
        responseBody: { ok: true },
      }),
    ).resolves.toBe(true);
  });

  it("returns false when lease token no longer matches (stale worker)", async () => {
    repo.complete.mockResolvedValue(false);
    await expect(
      service.complete({
        recordId: "rec-1",
        leaseToken: "stale-token",
        responseStatus: 200,
        responseBody: {},
      }),
    ).resolves.toBe(false);
  });

  it("propagates repository errors from complete()", async () => {
    repo.complete.mockRejectedValue(new Error("DB timeout"));
    await expect(
      service.complete({
        recordId: "rec-1",
        leaseToken: "token-1",
        responseStatus: 200,
        responseBody: {},
      }),
    ).rejects.toThrow("DB timeout");
  });

  // ---------------------------------------------------------------------------
  // fail()
  // ---------------------------------------------------------------------------

  it("returns true when fail() succeeds", async () => {
    repo.fail.mockResolvedValue(true);
    await expect(service.fail({ recordId: "rec-1", leaseToken: "token-1" })).resolves.toBe(true);
  });

  it("returns false when lease token no longer matches on fail()", async () => {
    repo.fail.mockResolvedValue(false);
    await expect(service.fail({ recordId: "rec-1", leaseToken: "stale-token" })).resolves.toBe(
      false,
    );
  });

  it("propagates repository errors from fail()", async () => {
    repo.fail.mockRejectedValue(new Error("Network error"));
    await expect(service.fail({ recordId: "rec-1", leaseToken: "token-1" })).rejects.toThrow(
      "Network error",
    );
  });
});
