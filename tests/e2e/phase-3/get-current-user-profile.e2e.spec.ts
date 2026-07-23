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
import { createSupabaseAuthGateway } from "../../../src/features/auth/supabase-auth-gateway.js";

describe("E2E: Get Current User Profile API", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const userIdentity = generateTestIdentity("me-api-valid");
  let validAccessToken: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Provision user
    const aRes = await testAdminClient.auth.admin.createUser({
      email: userIdentity.email,
      password: userIdentity.password,
      email_confirm: true,
    });
    testUsers.push(aRes.data.user!.id);

    // Login user
    const loginRes = await authGateway.loginWithPassword({
      email: userIdentity.email,
      password: userIdentity.password,
    });
    if (!loginRes.success) throw new Error("Failed to login test user");
    validAccessToken = loginRes.session.accessToken;
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  it("GET /api/v1/users/me retrieves the profile when valid token provided", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .expect(HTTP_STATUS.OK);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toBeDefined();
    expect(response.body.data.user.email).toBe(userIdentity.email);
    expect(response.body.data.user.accountStatus).toBe("active");
    expect(response.body.data.user.deletedAt).toBeUndefined(); // Internal field stripped
  });

  it("GET /api/v1/users/me returns 401 when token is missing", async () => {
    const response = await request(app).get("/api/v1/users/me").expect(HTTP_STATUS.UNAUTHORIZED);

    expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("GET /api/v1/users/me returns 401 when token is invalid", async () => {
    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer invalid-token`)
      .expect(HTTP_STATUS.UNAUTHORIZED);

    expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
  });
});
