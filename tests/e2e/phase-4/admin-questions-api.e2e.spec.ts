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

describe("E2E: Admin Questions API (Phase 4.4)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const adminIdentity = generateTestIdentity("admin-valid");
  const studentIdentity = generateTestIdentity("student-invalid");
  let adminAccessToken: string;
  let studentAccessToken: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Provision admin user
    const adminRes = await testAdminClient.auth.admin.createUser({
      email: adminIdentity.email,
      password: adminIdentity.password,
      email_confirm: true,
    });
    testUsers.push(adminRes.data.user!.id);

    // Make admin
    await testAdminClient.from("users").update({ role: "admin" }).eq("id", adminRes.data.user!.id);

    const adminLogin = await authGateway.loginWithPassword({
      email: adminIdentity.email,
      password: adminIdentity.password,
    });
    if (!adminLogin.success) throw new Error("Failed to login admin user");
    adminAccessToken = adminLogin.session.accessToken;

    // Provision student user
    const studentRes = await testAdminClient.auth.admin.createUser({
      email: studentIdentity.email,
      password: studentIdentity.password,
      email_confirm: true,
    });
    testUsers.push(studentRes.data.user!.id);

    const studentLogin = await authGateway.loginWithPassword({
      email: studentIdentity.email,
      password: studentIdentity.password,
    });
    if (!studentLogin.success) throw new Error("Failed to login student user");
    studentAccessToken = studentLogin.session.accessToken;
  });

  afterAll(async () => {
    for (const uid of testUsers) {
      await cleanupTestUser(uid);
    }
    server.close();
  });

  describe("Authorization & Security", () => {
    it("should reject student users with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${studentAccessToken}`);
      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });

    it("should reject unauthenticated users with 401 Unauthorized", async () => {
      const res = await request(app).get("/api/v1/admin/questions");
      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe("Taxonomy Management", () => {
    it("should create a new skill taxonomy", async () => {
      const suiteSuffix = `${process.pid}-${Date.now()}`;
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-1-${suiteSuffix}`)
        .send({
          slug: `test-skill-admin-${suiteSuffix}`,
          name: `Test Skill Admin ${suiteSuffix}`,
          description: "A test skill for e2e",
        });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(`test-skill-admin-${suiteSuffix}`);
    });

    it("should return 409 Conflict when creating a taxonomy with a duplicate slug", async () => {
      const suiteSuffix = `${process.pid}-${Date.now()}`;
      const duplicateSlug = `conflict-skill-${suiteSuffix}`;

      // First creation should succeed
      const res1 = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-2-${suiteSuffix}`)
        .send({
          slug: duplicateSlug,
          name: `Original Skill ${suiteSuffix}`,
        });
      expect(res1.status).toBe(HTTP_STATUS.CREATED);

      // Second creation with the same slug should fail with 409
      const res2 = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-3-${suiteSuffix}`)
        .send({
          slug: duplicateSlug,
          name: `Duplicate Skill ${suiteSuffix}`,
        });

      expect(res2.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res2.body.success).toBe(false);
      expect(res2.body.code).toBe("RESOURCE_CONFLICT");
      // Must not expose database internals
      expect(res2.body.message).not.toMatch(/idx_.*_slug/i);
      expect(res2.body.message).not.toContain("duplicate key value violates unique constraint");
    });
  });

  describe("Question Lifecycle", () => {
    let questionId: string;
    let categoryId: string;
    let difficultyId: string;
    let interviewTypeId: string;
    let skillId: string;

    const suiteSuffix = `${process.pid}-${Date.now()}`;
    const taxonomySlugs = {
      category: `cat-admin-${suiteSuffix}`,
      difficulty: `diff-admin-${suiteSuffix}`,
      interviewType: `type-admin-${suiteSuffix}`,
      skill: `skill-admin-${suiteSuffix}`,
    };

    beforeAll(async () => {
      // Create required taxonomies sequentially
      const r1 = await request(app)
        .post("/api/v1/admin/taxonomies/categories")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-4-${suiteSuffix}`)
        .send({ slug: taxonomySlugs.category, name: `Cat Admin ${suiteSuffix}` });
      expect(r1.status).toBe(201);
      categoryId = r1.body.data.id;

      const r2 = await request(app)
        .post("/api/v1/admin/taxonomies/difficulties")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-5-${suiteSuffix}`)
        .send({ slug: taxonomySlugs.difficulty, name: `Diff Admin ${suiteSuffix}` });
      expect(r2.status).toBe(201);
      difficultyId = r2.body.data.id;

      const r3 = await request(app)
        .post("/api/v1/admin/taxonomies/interview-types")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-6-${suiteSuffix}`)
        .send({ slug: taxonomySlugs.interviewType, name: `Type Admin ${suiteSuffix}` });
      expect(r3.status).toBe(201);
      interviewTypeId = r3.body.data.id;

      const r4 = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-7-${suiteSuffix}`)
        .send({ slug: taxonomySlugs.skill, name: `Skill Admin ${suiteSuffix}` });
      expect(r4.status).toBe(201);
      skillId = r4.body.data.id;
    });

    it("should create a new question in draft status", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-8-${suiteSuffix}`)
        .send({
          questionText: "What is the meaning of life?",
          categoryId,
          difficultyId,
          interviewTypeId,
          skillIds: [skillId],
          referenceAnswer: "42 is the answer",
        });

      expect(res.status).toBe(HTTP_STATUS.CREATED);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("draft");
      expect(res.body.data.referenceAnswer).toBe("42 is the answer");
      questionId = res.body.data.id;
    });

    it("should publish a draft question", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/publish`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-9-${suiteSuffix}`);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("published");
    });

    it("should archive a published question", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/archive`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-10-${suiteSuffix}`);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("archived");
    });

    it("should restore an archived question", async () => {
      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/restore`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `test-key-11-${suiteSuffix}`);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("draft");
    });
  });
});
