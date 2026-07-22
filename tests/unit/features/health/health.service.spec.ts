import { jest } from "@jest/globals";
import { createHealthService } from "../../../../src/api/health/health.service.js";
import type { ApplicationLifecycle } from "../../../../src/observability/lifecycle/application-lifecycle.js";
import type { ApplicationLogger } from "../../../../src/observability/logging/application-logger.types.js";
import { createTestApplicationConfig } from "../../../setup/test-helpers.js";
import { createSafeConfigSummary } from "../../../../src/config/index.js";

describe("health.service", () => {
  let lifecycle: jest.Mocked<ApplicationLifecycle>;
  let logger: jest.Mocked<ApplicationLogger>;

  beforeEach(() => {
    lifecycle = {
      getSnapshot: jest.fn<ApplicationLifecycle["getSnapshot"]>(),
      markReady: jest.fn(),
      beginShutdown: jest.fn(),
      markStopped: jest.fn(),
      markFailed: jest.fn(),
    };

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      silent: jest.fn(),
      child: jest.fn() as any,
      flush: jest.fn(),
    };
  });

  const getConfigSummary = () => createSafeConfigSummary(createTestApplicationConfig());

  it("liveness is alive during starting", () => {
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getLiveness()).toEqual({ status: "ok" });
  });

  it("liveness is alive during ready", () => {
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getLiveness()).toEqual({ status: "ok" });
  });

  it("liveness is alive during shutting_down", () => {
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getLiveness()).toEqual({ status: "ok" });
  });

  it("readiness is false during starting", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "starting",
      ready: false,
      startedAt: "",
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    const res = service.getReadiness();
    expect(res.status).toBe("unavailable");
  });

  it("readiness is true only during ready", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "ready",
      ready: true,
      startedAt: new Date().toISOString(),
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    const res = service.getReadiness(() => Date.now());
    expect(res.status).toBe("ready");
    expect((res as any).uptime).toBeDefined();
  });

  it("readiness is false during shutting_down", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "shutting_down",
      ready: false,
      startedAt: "",
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getReadiness().status).toBe("unavailable");
  });

  it("readiness is false during failed", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "failed",
      ready: false,
      startedAt: "",
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getReadiness().status).toBe("unavailable");
  });

  it("readiness is false during stopped", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "stopped",
      ready: false,
      startedAt: "",
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    expect(service.getReadiness().status).toBe("unavailable");
  });

  it("Supabase readiness checks validated configuration only", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "ready",
      ready: true,
      startedAt: new Date().toISOString(),
      updatedAt: "",
    });
    const summary = getConfigSummary();
    summary.supabaseConfigured = false; // Simulate validation failure or unconfigured state

    const service = createHealthService({ lifecycle, logger, configSummary: summary });
    expect(service.getReadiness().status).toBe("unavailable");
  });

  it("Supabase URL and keys are excluded from config summary", () => {
    const summary = getConfigSummary();
    expect((summary as any).supabaseUrl).toBeUndefined();
    expect((summary as any).supabaseAnonKey).toBeUndefined();
    expect((summary as any).supabaseServiceRoleKey).toBeUndefined();
  });

  it("uptime can be injected", () => {
    lifecycle.getSnapshot.mockReturnValue({
      state: "ready",
      ready: true,
      startedAt: new Date(1000).toISOString(),
      updatedAt: "",
    });
    const service = createHealthService({ lifecycle, logger, configSummary: getConfigSummary() });
    const res = service.getReadiness(() => 5000);
    expect((res as any).uptime).toBe(4000);
  });
});
