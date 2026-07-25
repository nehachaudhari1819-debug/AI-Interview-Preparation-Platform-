import { jest } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";
import {
  createGetPreferencesController,
  createUpdatePreferencesController,
} from "../../../../src/features/users/user-preferences.controller.js";
import type { UserPreferencesService } from "../../../../src/features/users/user-preferences.service.js";
import { AppError } from "../../../../src/errors/app-error.js";

describe("UserPreferencesController", () => {
  let service: jest.Mocked<UserPreferencesService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    service = {
      getPreferences: jest.fn<any>(),
      updatePreferences: jest.fn<any>(),
    } as any;

    req = {
      context: {
        requestId: "test-request-id",
        authentication: {
          principal: {
            userId: "user-1",
            role: "student",
          },
        },
      } as any,
      body: {},
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn() as any,
      set: jest.fn() as any,
      locals: {
        userPreferencesService: service,
      },
    };
    next = jest.fn();
  });

  describe("getPreferences", () => {
    it("should return preferences with 200 and Cache-Control no-store", async () => {
      service.getPreferences.mockResolvedValue({ locale: "en" } as any);

      const handler = createGetPreferencesController();
      await handler(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { locale: "en" },
        }),
      );
    });

    it("should throw 500 if service is missing from locals", async () => {
      res.locals = {};
      const handler = createGetPreferencesController();
      await expect(handler(req as Request, res as Response, next)).rejects.toThrow();
    });
  });

  describe("updatePreferences", () => {
    it("should update preferences and return 200", async () => {
      req.body = { locale: "fr" };
      service.updatePreferences.mockResolvedValue({ locale: "fr" } as any);

      const handler = createUpdatePreferencesController();
      await handler(req as Request, res as Response, next);

      expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: { locale: "fr" },
        }),
      );
      expect(service.updatePreferences).toHaveBeenCalledWith("user-1", { locale: "fr" });
    });

    it("should pass AppError with VALIDATION_ERROR to next if validation fails", async () => {
      req.body = { locale: "" }; // invalid
      const handler = createUpdatePreferencesController();

      await handler(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const err = (next as jest.Mock).mock.calls[0]![0] as AppError;
      expect(err.code).toBe("VALIDATION_ERROR");

      expect(service.updatePreferences).not.toHaveBeenCalled();
    });
  });
});
