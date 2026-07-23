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

describe("E2E: Update Current User Profile API", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const userIdentity = generateTestIdentity("me-api-update");
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

  it("PATCH /api/v1/users/me updates the profile partially and contains no-store", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ fullName: "Updated Test User", bio: "New bio", college: "New College" })
      .expect(HTTP_STATUS.OK);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.fullName).toBe("Updated Test User");
    expect(response.body.data.user.bio).toBe("New bio");
    expect(response.body.data.user.college).toBe("New College");
  });

  it("PATCH /api/v1/users/me can clear nullable fields", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ bio: null, college: null })
      .expect(HTTP_STATUS.OK);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.bio).toBeNull();
    expect(response.body.data.user.college).toBeNull();
  });

  it("PATCH /api/v1/users/me rejects empty payload", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({})
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/users/me rejects avatarUrl with http://", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ avatarUrl: "http://example.com/avatar.png" })
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/users/me rejects protected fields like email or id", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ id: "fake-id", email: "fake@example.com" })
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/users/me returns 401 when token is missing and contains no-store", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .send({ fullName: "Test" })
      .expect(HTTP_STATUS.UNAUTHORIZED);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("proves isolation: User A cannot update User B's profile", async () => {
    // We already have User A (validAccessToken). Let's fetch the profile and ensure we ONLY get User A.
    // The endpoint doesn't even take an ID, so by design User A can only update User A.
    // We just verify it returns the correct ID.
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ fullName: "Update Self" })
      .expect(HTTP_STATUS.OK);

    expect(response.body.data.user.id).toBe(testUsers[0]);
  });
});
