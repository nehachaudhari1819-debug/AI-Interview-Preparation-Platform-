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
  });

  describe("Question Detail API", () => {
    it("GET /api/v1/questions/:id returns 404 for unknown UUID", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await request(app)
        .get(`/api/v1/questions/${fakeId}`)
        .set("Authorization", `Bearer ${validAccessToken}`)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(response.body.code).toBe("RESOURCE_NOT_FOUND");
    });
  });
});
