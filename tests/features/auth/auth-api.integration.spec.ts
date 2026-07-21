import { jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { loadApplicationConfig } from "../../../src/config/app-config.js";
import { createAuthService } from "../../../src/features/auth/auth.service.js";
import { createAuthRouter } from "../../../src/features/auth/auth.router.js";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import { Router } from "express";

jest.mock("../../../src/features/auth/auth.service.js");

describe("Auth API Integration", () => {
  let app: Express;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      register: jest.fn().mockResolvedValue({ result: { status: "verification_required" } }),
      login: jest
        .fn()
        .mockResolvedValue({ publicSession: { status: "authenticated" }, refreshToken: "token" }),
      refresh: jest.fn().mockResolvedValue({
        publicSession: { status: "authenticated" },
        rotatedRefreshToken: "token2",
      }),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    (createAuthService as jest.Mock).mockReturnValue(mockAuthService);

    const config = loadApplicationConfig();
    const authRouter = createAuthRouter({ config });
    const apiRouter = Router();
    apiRouter.use("/auth", authRouter);

    app = createApp({ config, apiRouter });
  });

  it("POST /api/v1/auth/register calls service and returns response", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "test@example.com",
      password: "Password123!",
    });
    expect(res.status).toBe(HTTP_STATUS.ACCEPTED);
    expect(mockAuthService.register).toHaveBeenCalled();
  });
});
