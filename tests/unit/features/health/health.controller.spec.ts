import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createHealthController } from "../../../../src/api/health/health.controller.js";
import type { HealthService } from "../../../../src/api/health/health.service.js";

describe("health.controller", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let healthService: jest.Mocked<HealthService>;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
      setHeader: jest.fn() as any,
    };
    healthService = {
      getLiveness: jest.fn().mockReturnValue({ status: "ok" }),
      getReadiness: jest.fn().mockReturnValue({ status: "ready", state: "ready", uptime: 1000 }),
      getConfig: jest.fn().mockReturnValue({}),
    };
  });

  it("getLiveness returns 200", () => {
    const controller = createHealthController({ healthService });
    controller.getLiveness(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
  });

  it("getReadiness returns 200 while ready", () => {
    const controller = createHealthController({ healthService });
    controller.getReadiness(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getReadiness returns 503 while not ready", () => {
    healthService.getReadiness.mockReturnValue({ status: "unavailable", state: "starting" });
    const controller = createHealthController({ healthService });
    controller.getReadiness(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it("Cache-Control: no-store exists", () => {
    const controller = createHealthController({ healthService });
    controller.getLiveness(req as Request, res as Response);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });

  it("Pragma: no-cache exists", () => {
    const controller = createHealthController({ healthService });
    controller.getLiveness(req as Request, res as Response);
    expect(res.setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
  });
});
