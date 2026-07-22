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

describe("Real Environment: POST /auth/login and GET /auth/session", () => {
  let app: Express;
  let server: Server;
  const identity = generateTestIdentity("login-session");
  let userId: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Pre-provision a user directly via admin client so we know it exists and is confirmed
    const { data, error } = await testAdminClient.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true, // Force confirmation
    });

    if (error || !data.user) {
      throw new Error(`Failed to provision test user: ${error?.message}`);
    }
    userId = data.user.id;
  });

  afterAll(async () => {
    server.close();
    await cleanupTestUser(userId);
  });

  it("fails safely for unknown email with a generic error", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "unknown-nobody@example.test",
        password: "WrongPassword123!",
      })
      .expect("Content-Type", /json/)
      .expect(HTTP_STATUS.UNAUTHORIZED);

    const body = response.body;
    expect(body.code).toBe("INVALID_LOGIN_CREDENTIALS");
  });

  it("fails safely for known email but wrong password with the same generic error", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: identity.email,
        password: "WrongPassword123!",
      })
      .expect("Content-Type", /json/)
      .expect(HTTP_STATUS.UNAUTHORIZED);

    const body = response.body;
    expect(body.code).toBe("INVALID_LOGIN_CREDENTIALS");
  });

  it("logs in successfully and establishes a valid session", async () => {
    // 1. Login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: identity.email,
        password: identity.password,
      })
      .expect(HTTP_STATUS.OK);

    const loginBody = loginRes.body;

    // Assert access token is in payload
    expect(loginBody.data.accessToken).toBeDefined();
    // Assert refresh token is NOT in payload
    expect(loginBody.data.refreshToken).toBeUndefined();

    // Assert refresh token is in HttpOnly cookie
    const cookies = loginRes.headers["set-cookie"] as unknown as string[];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c) => c.startsWith("aiip_refresh="));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("SameSite=Lax");

    const accessToken = loginBody.data.accessToken;

    // 2. Fetch session using access token
    const sessionRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(HTTP_STATUS.OK);

    const sessionBody = sessionRes.body;
    expect(sessionBody.data.principal).toBeDefined();
    expect(sessionBody.data.principal.userId).toBe(userId);
    expect(sessionBody.data.principal.email).toBe(identity.email);
    expect(sessionBody.data.principal.applicationRole).toBeNull();

    // Verify response headers for security
    expect(sessionRes.headers["cache-control"]).toContain("no-store");
  });
});
