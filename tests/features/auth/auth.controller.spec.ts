import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createLoginController } from "../../../src/features/auth/auth.controller.js";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import type { AuthService } from "../../../src/features/auth/auth.service.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";

jest.mock("../../../src/features/auth/auth-cookie.js", () => ({
  setRefreshTokenCookie: jest.fn(),
}));

describe("AuthController", () => {
  it("login calls service and sends success response", async () => {
    const mockService = {
      login: jest.fn().mockResolvedValue({
        publicSession: { status: "authenticated" },
        refreshToken: "ref-token",
      }),
    };

    const req = {
      body: { email: "test@example.com", password: "Password123!" },
      context: { requestId: "req-1" },
    } as unknown as Request;

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const controller = createLoginController(
      {} as unknown as Readonly<ApplicationConfig>,
      mockService as unknown as AuthService,
    );
    await controller(req, res, jest.fn());

    expect(mockService.login).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "Password123!",
    });
    expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { status: "authenticated" },
      }),
    );
  });
});
