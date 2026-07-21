import { jest } from "@jest/globals";
import request from "supertest";
import type { Express } from "express";
import { createApp } from "../../../src/app.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";
import { createAuthService } from "../../../src/features/auth/auth.service.js";
import { createAuthRouter } from "../../../src/features/auth/auth.router.js";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import { Router } from "express";

// removed jest.mock

describe("Auth API Integration", () => {
  let app: Express;
  let mockAuthService: any;

  beforeEach(() => {
    mockAuthService = {
      register: jest.fn<any>().mockResolvedValue({ result: { status: "verification_required" } }),
      login: jest
        .fn<any>()
        .mockResolvedValue({ publicSession: { status: "authenticated" }, refreshToken: "token" }),
      refresh: jest.fn<any>().mockResolvedValue({
        publicSession: { status: "authenticated" },
        rotatedRefreshToken: "token2",
      }),
      logout: jest.fn<any>().mockResolvedValue(undefined),
    };

    const config = createTestApplicationConfig();
    const authRouter = createAuthRouter({ config, authService: mockAuthService });
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
