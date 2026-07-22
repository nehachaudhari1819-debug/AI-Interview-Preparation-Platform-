import request from "supertest";
import {
  appConfig,
  createTestApp,
  generateTestIdentity,
  cleanupTestUser,
  testAdminClient,
} from "../../setup/real-environment.js";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import type { Express } from "express";
import type { Server } from "node:http";

describe("Real Environment: POST /auth/refresh and POST /auth/logout", () => {
  let app: Express;
  let server: Server;
  const identity = generateTestIdentity("refresh-logout");
  let userId: string;
  let validRefreshCookie: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Pre-provision a user directly via admin client
    const { data, error } = await testAdminClient.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw new Error(`Failed to provision test user: ${error?.message}`);
    }
    userId = data.user.id;

    // Login to get the initial refresh cookie
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: identity.email,
      password: identity.password,
    });

    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    validRefreshCookie = cookies.find((c) => c.startsWith("aiip_refresh="))!;
    if (!validRefreshCookie) {
      throw new Error("Failed to get initial refresh cookie");
    }
  });

  afterAll(async () => {
    server.close();
    await cleanupTestUser(userId);
  });

  it("fails safely if refresh cookie is missing", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .expect(HTTP_STATUS.UNAUTHORIZED);

    const body = response.body;
    expect(body.code).toBe("REFRESH_SESSION_REQUIRED");
  });

  it("rotates the refresh token successfully", async () => {
    const response = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", validRefreshCookie)
      .expect(HTTP_STATUS.OK);

    const body = response.body;

    // Access token should be returned
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.refreshToken).toBeUndefined();

    // New refresh token should be in cookie
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const newRefreshCookieStr = cookies.find((c) => c.startsWith("aiip_refresh="))!;
    expect(newRefreshCookieStr).toBeDefined();

    // Parse the actual value out to ensure it rotated
    if (!validRefreshCookie || !newRefreshCookieStr) {
      throw new Error("Missing cookies for comparison");
    }
    const oldVal = validRefreshCookie.split(";")[0]!.split("=")[1];
    const newVal = newRefreshCookieStr.split(";")[0]!.split("=")[1];
    expect(newVal).not.toBe(oldVal);

    validRefreshCookie = newRefreshCookieStr; // Save for next tests
  });

  it("blocks replay of the old refresh token (reuse detection)", async () => {
    // Wait for 11 seconds to outlast Supabase's refresh_token_reuse_interval (10s by default)
    // Otherwise, GoTrue will allow the replay due to the concurrency grace period.
    await new Promise((resolve) => setTimeout(resolve, 11000));

    // We already rotated validRefreshCookie above, so if we try to use the very first one we got, it should fail.
    // Wait, let's login again to guarantee a fresh rotation state.
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: identity.email, password: identity.password });

    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    const initialCookie = cookies.find((c) => c.startsWith("aiip_refresh="))!;

    // 1st Refresh (Success)
    const refresh1 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", initialCookie)
      .expect(HTTP_STATUS.OK);

    // Wait another 11 seconds because the 10-second reuse interval applies AFTER the token is used.
    await new Promise((resolve) => setTimeout(resolve, 11000));

    // 2nd Refresh with the exact same initial cookie (Replay attack)
    const refresh2 = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", initialCookie)
      .expect(HTTP_STATUS.UNAUTHORIZED);

    const body = refresh2.body;
    expect(body.code).toBe("INVALID_REFRESH_SESSION");

    // Capture the valid cookie for logout test
    const newCookies = refresh1.headers["set-cookie"] as unknown as string[];
    validRefreshCookie = newCookies.find((c) => c.startsWith("aiip_refresh="))!;
  }, 30000); // Increase Jest timeout for this specific test due to the 22 seconds of wait time.

  it("logs out and clears the refresh cookie", async () => {
    const response = await request(app)
      .post("/api/v1/auth/logout")
      .set("Cookie", validRefreshCookie)
      .expect(HTTP_STATUS.NO_CONTENT);

    // Assert cookie is cleared
    const cookies = response.headers["set-cookie"] as unknown as string[];
    const refreshCookie = cookies.find((c) => c.startsWith("aiip_refresh="))!;
    expect(refreshCookie).toContain("Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    expect(refreshCookie).toContain("HttpOnly");

    // Verify it cannot be used to refresh anymore
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", validRefreshCookie)
      .expect(HTTP_STATUS.UNAUTHORIZED);
  });
});
