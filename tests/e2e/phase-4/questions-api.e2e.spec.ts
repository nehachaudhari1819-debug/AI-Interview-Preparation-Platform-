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

describe("E2E: Questions API (Student Phase 4.3)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const userIdentity = generateTestIdentity("q-api-valid");
  const suspendedIdentity = generateTestIdentity("q-api-susp");
  let validAccessToken: string;
  let suspendedAccessToken: string;

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

    // Provision and suspend user
    const sRes = await testAdminClient.auth.admin.createUser({
      email: suspendedIdentity.email,
      password: suspendedIdentity.password,
      email_confirm: true,
    });
    testUsers.push(sRes.data.user!.id);

    // Hard-suspend in public.users
    await testAdminClient
      .from("users")
      .update({ account_status: "suspended" })
      .eq("id", sRes.data.user!.id);

    // Login suspended user
    const loginSusp = await authGateway.loginWithPassword({
      email: suspendedIdentity.email,
      password: suspendedIdentity.password,
    });
    if (loginSusp.success) {
      suspendedAccessToken = loginSusp.session.accessToken;
    }
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  describe("Taxonomy APIs", () => {
    it("GET /api/v1/questions/categories returns taxonomy list successfully", async () => {
      const response = await request(app)
        .get("/api/v1/questions/categories")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.meta.requestId).toBeDefined();
    });

    it("GET /api/v1/questions/difficulties returns taxonomy list successfully", async () => {
      const response = await request(app)
        .get("/api/v1/questions/difficulties")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions/interview-types returns taxonomy list successfully", async () => {
      const response = await request(app)
        .get("/api/v1/questions/interview-types")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions/skills returns taxonomy list successfully", async () => {
      const response = await request(app)
        .get("/api/v1/questions/skills")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions/topics returns taxonomy list successfully", async () => {
      const response = await request(app)
        .get("/api/v1/questions/topics")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions/invalid returns 422 from standard routing", async () => {
      // It hits 404 because neither taxonomy nor id matches cleanly without error,
      // actually wait, /invalid might match /:questionId which expects a UUID and throws ValidationError.
      const response = await request(app)
        .get("/api/v1/questions/invalid")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY); // Validation error for invalid UUID

      expect(response.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Security and Authorization", () => {
    it("should reject anonymous requests", async () => {
      await request(app).get("/api/v1/questions/categories").expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app).get("/api/v1/questions").expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it("should reject invalid tokens", async () => {
      await request(app)
        .get("/api/v1/questions")
        .set("Authorization", "Bearer invalid.token.here")
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });

    it("should reject suspended users", async () => {
      if (suspendedAccessToken) {
        await request(app)
          .get("/api/v1/questions")
          .set("Authorization", `Bearer ${suspendedAccessToken}`)
          .expect(HTTP_STATUS.FORBIDDEN);
      }
    });
  });

  describe("Questions List API", () => {
    it("GET /api/v1/questions returns paginated questions", async () => {
      const response = await request(app)
        .get("/api/v1/questions?page=1&limit=5")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);

      // Verify safety - no internal fields should be present
      if (response.body.data.length > 0) {
        const first = response.body.data[0];
        expect(first.status).toBeUndefined();
        expect(first.created_by).toBeUndefined();
      }
    });

    it("GET /api/v1/questions applies search filter properly", async () => {
      const response = await request(app)
        .get("/api/v1/questions?search=react")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions applies taxonomy filters properly", async () => {
      const response = await request(app)
        .get(
          "/api/v1/questions?categoryId=00000000-0000-4000-8000-000000000001&difficultyId=00000000-0000-4000-8000-000000000001",
        )
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("GET /api/v1/questions handles out of range pages correctly", async () => {
      const response = await request(app)
        .get("/api/v1/questions?page=10000&limit=20")
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.OK);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(0);
      expect(response.body.pagination.totalItems).toBeDefined();
    });
  });

  describe("Question Detail API", () => {
    it("GET /api/v1/questions/:id returns 404 for unknown UUID", async () => {
      const fakeId = "00000000-0000-4000-8000-000000000000";
      const response = await request(app)
        .get(`/api/v1/questions/${fakeId}`)
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.code).toBe("RESOURCE_NOT_FOUND");
    });

    it("GET /api/v1/questions/:id successfully returns detail without sensitive fields", async () => {
      // Find a real question ID first
      const listResp = await request(app)
        .get("/api/v1/questions?limit=1")
        .set("Authorization", `Bearer ${validAccessToken}`);

      if (listResp.body.data.length > 0) {
        const questionId = listResp.body.data[0].id;

        const response = await request(app)
          .get(`/api/v1/questions/${questionId}`)
          .set("Authorization", `Bearer ${validAccessToken}`)
          .expect(HTTP_STATUS.OK);

        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(questionId);
        expect(response.body.data.questionText).toBeDefined();

        // Sensitive field exclusion
        expect(response.body.data.status).toBeUndefined();
        expect(response.body.data.reference_answer).toBeUndefined();
        expect(response.body.data.referenceAnswer).toBeUndefined();
        expect(response.body.data.evaluation_guidance).toBeUndefined();
        expect(response.body.data.evaluationGuidance).toBeUndefined();
      }
    });
  });
});
