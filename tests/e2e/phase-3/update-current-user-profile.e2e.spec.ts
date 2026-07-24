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

  it("PATCH /api/v1/users/me updates the profile partially and confirms with GET", async () => {
    const patchResponse = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ fullName: "Updated Test User", bio: "New bio", college: "New College" })
      .expect(HTTP_STATUS.OK);

    expect(patchResponse.headers["cache-control"]).toBe("no-store");
    expect(patchResponse.body.success).toBe(true);
    expect(patchResponse.body.data.user.fullName).toBe("Updated Test User");
    expect(patchResponse.body.data.user.bio).toBe("New bio");

    // Verify secrets are excluded
    expect(patchResponse.body.data.user).not.toHaveProperty("password");
    expect(patchResponse.body.data.user).not.toHaveProperty("token");

    const getResponse = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .expect(HTTP_STATUS.OK);

    expect(getResponse.body.data.user.fullName).toBe("Updated Test User");
    expect(getResponse.body.data.user.bio).toBe("New bio");
    expect(getResponse.body.data.user.college).toBe("New College");
  });

  it("PATCH /api/v1/users/me normalizes preferred-roles and empty strings", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ preferredRoles: ["  backend  ", "frontend", " backend"], bio: "   " })
      .expect(HTTP_STATUS.OK);

    expect(response.body.data.user.preferredRoles).toEqual(["backend", "frontend"]);
    expect(response.body.data.user.bio).toBeNull();
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

  it("PATCH /api/v1/users/me rejects unknown fields", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({ fullName: "Valid", someUnknownField: "should fail" })
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.body.code).toBe("VALIDATION_ERROR");
  });

  it("PATCH /api/v1/users/me rejects empty payload", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .send({})
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.headers["cache-control"]).toBe("no-store");
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

  it("PATCH /api/v1/users/me ignores ownership attacks in headers or payload", async () => {
    // Should reject payload id override and not leak state of other user
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .set("x-user-id", "some-other-id") // header attack
      .send({ id: "fake-id", email: "fake@example.com", fullName: "Attacker" })
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(response.body.code).toBe("VALIDATION_ERROR");

    // Let's do a valid update but with a header attack
    const response2 = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessToken}`)
      .set("x-user-id", "some-other-id") // header attack
      .send({ fullName: "Attacker Valid" })
      .expect(HTTP_STATUS.OK);

    // It should still just update the currently authenticated user
    expect(response2.body.data.user.id).toBe(testUsers[0]);
    expect(response2.body.data.user.fullName).toBe("Attacker Valid");
  });

  it("PATCH /api/v1/users/me returns 401 when token is missing and contains no-store", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me")
      .send({ fullName: "Test" })
      .expect(HTTP_STATUS.UNAUTHORIZED);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("PATCH /api/v1/users/me fail-closed behavior for inactive account", async () => {
    const delIdentity = generateTestIdentity("me-api-inactive");
    const delUser = await testAdminClient.auth.admin.createUser({
      email: delIdentity.email,
      password: delIdentity.password,
      email_confirm: true,
    });
    testUsers.push(delUser.data.user!.id);

    // login
    const loginRes = await authGateway.loginWithPassword({
      email: delIdentity.email,
      password: delIdentity.password,
    });

    if (!loginRes.success) throw new Error("Login failed");
    const inactiveToken = loginRes.session.accessToken;

    // soft-delete user directly in database via admin
    await testAdminClient
      .from("users")
      .update({ account_status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", delUser.data.user!.id);

    // Now try to update the deleted profile
    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${inactiveToken}`)
      .send({ fullName: "Will fail" })
      .expect(HTTP_STATUS.FORBIDDEN);

    expect(response.body.code).toBe("ACCOUNT_DELETED");
  });
});
