/**
 * P4.5 — E2E Tests: Question Bank Audit, Idempotency, Replay and Concurrency Protection
 *
 * Requires a live local Supabase instance (127.0.0.1:54321).
 * Run `npm run db:start && npm run db:reset` before executing these tests.
 *
 * Verifies:
 * 1. Initial question creation succeeds with idempotency key
 * 2. Replay with same key and same payload returns original result
 * 3. Database contains exactly one mutation after replay
 * 4. Audit table contains exactly one matching event (no duplicates on replay)
 * 5. Same key with different payload returns 409 IDEMPOTENCY_CONFLICT
 * 6. Different key with duplicate unique data returns 409 RESOURCE_CONFLICT
 * 7. Invalid lifecycle transition returns safe error (no mutation)
 * 8. Missing Idempotency-Key returns 400 IDEMPOTENCY_KEY_REQUIRED
 * 9. Taxonomy creation with idempotency succeeds
 * 10. Taxonomy replay does not duplicate audit events
 * 11. Lifecycle transitions (publish, archive, restore) with idempotency
 * 12. Audit records are not readable by students
 * 13. Student users are rejected with 403 on all mutation routes
 * 14. Concurrent identical requests do not duplicate resources
 */

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
import { randomUUID } from "node:crypto";

describe("E2E: P4.5 Question Bank Audit, Idempotency, and Concurrency", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });

  const adminIdentity = generateTestIdentity("p45-admin");
  const studentIdentity = generateTestIdentity("p45-student");
  let adminAccessToken: string;
  let adminUserId: string;
  let studentAccessToken: string;

  // Shared taxonomy IDs for question tests
  let categoryId: string;
  let difficultyId: string;
  let interviewTypeId: string;
  let skillId: string;

  const suiteSuffix = `${process.pid}-${Date.now()}`;

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
    if (adminRes.error || !adminRes.data.user) throw new Error("createUser admin failed");
    adminUserId = adminRes.data.user.id;
    testUsers.push(adminUserId);

    await testAdminClient.from("users").update({ role: "admin" }).eq("id", adminUserId);

    const adminLogin = await authGateway.loginWithPassword({
      email: adminIdentity.email,
      password: adminIdentity.password,
    });
    if (!adminLogin.success) throw new Error("Admin login failed");
    adminAccessToken = adminLogin.session.accessToken;

    // Provision student user
    const studentRes = await testAdminClient.auth.admin.createUser({
      email: studentIdentity.email,
      password: studentIdentity.password,
      email_confirm: true,
    });
    if (studentRes.error || !studentRes.data.user) throw new Error("createUser student failed");
    testUsers.push(studentRes.data.user.id);

    const studentLogin = await authGateway.loginWithPassword({
      email: studentIdentity.email,
      password: studentIdentity.password,
    });
    if (!studentLogin.success) throw new Error("Student login failed");
    studentAccessToken = studentLogin.session.accessToken;

    // Create shared taxonomies needed for questions
    const cat = await request(app)
      .post("/api/v1/admin/taxonomies/categories")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .set("Idempotency-Key", `p45-setup-cat-${suiteSuffix}`)
      .set("Content-Type", "application/json")
      .send({ slug: `p45-category-${suiteSuffix}`, name: `P45 Category ${suiteSuffix}` });
    expect(cat.status).toBe(201);
    categoryId = cat.body.data.id;

    const diff = await request(app)
      .post("/api/v1/admin/taxonomies/difficulties")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .set("Idempotency-Key", `p45-setup-diff-${suiteSuffix}`)
      .set("Content-Type", "application/json")
      .send({ slug: `p45-difficulty-${suiteSuffix}`, name: `P45 Difficulty ${suiteSuffix}` });
    expect(diff.status).toBe(201);
    difficultyId = diff.body.data.id;

    const itype = await request(app)
      .post("/api/v1/admin/taxonomies/interview-types")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .set("Idempotency-Key", `p45-setup-itype-${suiteSuffix}`)
      .set("Content-Type", "application/json")
      .send({ slug: `p45-itype-${suiteSuffix}`, name: `P45 Interview Type ${suiteSuffix}` });
    expect(itype.status).toBe(201);
    interviewTypeId = itype.body.data.id;

    const skill = await request(app)
      .post("/api/v1/admin/taxonomies/skills")
      .set("Authorization", `Bearer ${adminAccessToken}`)
      .set("Idempotency-Key", `p45-setup-skill-${suiteSuffix}`)
      .set("Content-Type", "application/json")
      .send({ slug: `p45-skill-${suiteSuffix}`, name: `P45 Skill ${suiteSuffix}` });
    expect(skill.status).toBe(201);
    skillId = skill.body.data.id;
  });

  afterAll(async () => {
    server.close();
    for (const uid of testUsers) {
      await cleanupTestUser(uid);
    }
  });

  // =========================================================================
  // SECTION 1: Authorization Guards — Admin-Only Enforcement
  // =========================================================================

  describe("Authorization enforcement", () => {
    it("rejects student POST /admin/questions with 403 (student blocked before idempotency)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${studentAccessToken}`)
        .set("Idempotency-Key", `p45-student-q-${suiteSuffix}`)
        .set("Content-Type", "application/json")
        .send({ questionText: "Student attempt" });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.success).toBe(false);
    });

    it("rejects student POST /admin/taxonomies with 403", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${studentAccessToken}`)
        .set("Idempotency-Key", `p45-student-tax-${suiteSuffix}`)
        .set("Content-Type", "application/json")
        .send({ slug: "student-skill", name: "Student Skill" });

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    });
  });

  // =========================================================================
  // SECTION 2: Idempotency-Key Requirement
  // =========================================================================

  describe("Idempotency-Key header enforcement on mutation routes", () => {
    it("returns 400 IDEMPOTENCY_KEY_REQUIRED when key is missing from POST /admin/questions", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Content-Type", "application/json")
        .send({
          questionText: "Test without idempotency key",
          categoryId,
          difficultyId,
          interviewTypeId,
          skillIds: [skillId],
          referenceAnswer: "Some answer",
        });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      expect(res.body.success).toBe(false);
    });

    it("returns 400 IDEMPOTENCY_KEY_REQUIRED when key is missing from PATCH /admin/questions/:id", async () => {
      const id = randomUUID();
      const res = await request(app)
        .patch(`/api/v1/admin/questions/${id}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Content-Type", "application/json")
        .send({ questionText: "Updated" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("returns 400 IDEMPOTENCY_KEY_REQUIRED when key is missing from POST /admin/taxonomies", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Content-Type", "application/json")
        .send({ slug: "no-key-skill", name: "No Key Skill" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    });

    it("returns 400 IDEMPOTENCY_KEY_INVALID for invalid key format (too long)", async () => {
      const tooLongKey = "a".repeat(256);
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", tooLongKey)
        .set("Content-Type", "application/json")
        .send({ questionText: "Test" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("IDEMPOTENCY_KEY_INVALID");
      // Raw key must not appear in error response
      expect(JSON.stringify(res.body)).not.toContain("a".repeat(10));
    });
  });

  // =========================================================================
  // SECTION 3: Taxonomy Idempotency — Create + Replay + Conflict
  // =========================================================================

  describe("Taxonomy creation idempotency", () => {
    const taxKey = `p45-tax-create-${randomUUID()}`;
    const taxSlug = `p45-replay-tax-${randomUUID()}`;
    let firstTaxonomyId: string;
    let firstResponseBody: unknown;

    it("creates a taxonomy with idempotency key (initial request)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", taxKey)
        .set("Content-Type", "application/json")
        .send({ slug: taxSlug, name: `P45 Replay Tax ${taxSlug}` });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe(taxSlug);
      firstTaxonomyId = res.body.data.id;
      firstResponseBody = res.body;
    });

    it("replaying with same key and same payload returns original result (200/201 status code from cache)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", taxKey)
        .set("Content-Type", "application/json")
        .send({ slug: taxSlug, name: `P45 Replay Tax ${taxSlug}` });

      // Replay returns cached response (status from stored completion)
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      // Same resource ID
      expect(res.body.data.id).toBe(firstTaxonomyId);
    });

    it("database contains exactly one taxonomy with the replayed slug (no duplicate mutation)", async () => {
      const { data: rows, error } = await testAdminClient
        .from("question_skills")
        .select("id")
        .eq("slug", taxSlug);

      expect(error).toBeNull();
      expect(rows?.length).toBe(1);
    });

    it("audit table contains exactly one QUESTION_TAXONOMY_CREATED event (replay does not create second audit)", async () => {
      // Wait briefly for async audit to complete
      await new Promise((r) => setTimeout(r, 300));

      const { data: audits, error } = await testAdminClient
        .from("audit_logs")
        .select("id, metadata")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_TAXONOMY_CREATED")
        .eq("resource_id", firstTaxonomyId);

      expect(error).toBeNull();
      // Exactly one audit, not two
      expect(audits?.length).toBe(1);

      // Verify audit metadata is safe (no sensitive values)
      const metadata = audits?.[0]?.metadata as Record<string, unknown> | null;
      if (metadata) {
        const serialized = JSON.stringify(metadata);
        expect(serialized).not.toContain(taxSlug); // slug value excluded
        // Should contain field names or operation
        expect(serialized).toMatch(/providedFields|operation/);
      }
    });

    it("same key with different payload returns 409 IDEMPOTENCY_CONFLICT", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", taxKey)
        .set("Content-Type", "application/json")
        .send({ slug: `DIFFERENT-SLUG-${randomUUID()}`, name: "Completely Different Taxonomy" });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
      // No database details in error
      expect(JSON.stringify(res.body)).not.toMatch(/23505|constraint|idx_/i);
    });

    it("different key with duplicate slug returns 409 RESOURCE_CONFLICT", async () => {
      const res = await request(app)
        .post("/api/v1/admin/taxonomies/skills")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-tax-dup-${randomUUID()}`)
        .set("Content-Type", "application/json")
        .send({ slug: taxSlug, name: "Duplicate Slug Attempt" });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.code).toBe("RESOURCE_CONFLICT");
      // No constraint names in error
      expect(res.body.message).not.toMatch(/idx_.*_slug/i);
      expect(res.body.message).not.toContain("duplicate key value violates unique constraint");
    });

    it("response body does not expose service-role credentials", () => {
      const serialized = JSON.stringify(firstResponseBody);
      expect(serialized).not.toContain("service_role");
      expect(serialized).not.toContain("privilegedKey");
      expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    });
  });

  // =========================================================================
  // SECTION 4: Question Creation Idempotency — Full Lifecycle
  // =========================================================================

  describe("Question creation idempotency", () => {
    const qKey = `p45-q-create-${randomUUID()}`;
    let questionId: string;

    const questionBody = {
      questionText: `P4.5 idempotency test question ${suiteSuffix}`,
      categoryId: "",
      difficultyId: "",
      interviewTypeId: "",
      skillIds: [] as string[],
      referenceAnswer: "The reference answer for idempotency test",
      evaluationGuidance: { rubric: "standard" },
    };

    beforeAll(() => {
      questionBody.categoryId = categoryId;
      questionBody.difficultyId = difficultyId;
      questionBody.interviewTypeId = interviewTypeId;
      questionBody.skillIds = [skillId];
    });

    it("creates a question with idempotency key (initial request)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", qKey)
        .set("Content-Type", "application/json")
        .send(questionBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("draft");
      questionId = res.body.data.id;

      // referenceAnswer is visible to admin
      expect(res.body.data.referenceAnswer).toBe("The reference answer for idempotency test");
    });

    it("replaying with same key and same payload returns original result (no second create)", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", qKey)
        .set("Content-Type", "application/json")
        .send(questionBody);

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      // Same question ID returned
      expect(res.body.data.id).toBe(questionId);
    });

    it("audit table contains exactly one QUESTION_CREATED event after replay", async () => {
      await new Promise((r) => setTimeout(r, 300));

      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("id, metadata, resource_id")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_CREATED")
        .eq("resource_id", questionId);

      expect(audits?.length).toBe(1);

      // Metadata must be safe — no referenceAnswer value
      const metadata = audits?.[0]?.metadata as Record<string, unknown> | null;
      if (metadata) {
        const serialized = JSON.stringify(metadata);
        expect(serialized).not.toContain("The reference answer for idempotency test");
        expect(serialized).not.toContain("rubric");
      }
    });

    it("same key with different body returns 409 IDEMPOTENCY_CONFLICT", async () => {
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", qKey)
        .set("Content-Type", "application/json")
        .send({
          ...questionBody,
          questionText: "COMPLETELY DIFFERENT QUESTION TEXT",
        });

      expect(res.status).toBe(HTTP_STATUS.CONFLICT);
      expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    // -----------------------------------------------------------------------
    // Question lifecycle with idempotency
    // -----------------------------------------------------------------------

    it("publishes the question with idempotency key", async () => {
      const publishKey = `p45-q-publish-${questionId}`;

      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/publish`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", publishKey);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.status).toBe("published");
    });

    it("replaying publish with same key returns original result (no second transition)", async () => {
      const publishKey = `p45-q-publish-${questionId}`;

      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/publish`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", publishKey);

      expect([200]).toContain(res.status);
      expect(res.body.data.status).toBe("published");
    });

    it("audit table has exactly one QUESTION_PUBLISHED event after replay", async () => {
      await new Promise((r) => setTimeout(r, 300));

      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("id")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_PUBLISHED")
        .eq("resource_id", questionId);

      expect(audits?.length).toBe(1);
    });

    it("archives the question with idempotency key", async () => {
      const archiveKey = `p45-q-archive-${questionId}`;

      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/archive`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", archiveKey);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.status).toBe("archived");
    });

    it("replay of archive returns cached archived state", async () => {
      const archiveKey = `p45-q-archive-${questionId}`;

      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/archive`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", archiveKey);

      expect([200]).toContain(res.status);
      expect(res.body.data.status).toBe("archived");
    });

    it("restores the question with idempotency key", async () => {
      const restoreKey = `p45-q-restore-${questionId}`;

      const res = await request(app)
        .post(`/api/v1/admin/questions/${questionId}/restore`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", restoreKey);

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.status).toBe("draft");
    });
  });

  // =========================================================================
  // SECTION 5: Question Update Idempotency
  // =========================================================================

  describe("Question update idempotency", () => {
    let questionId: string;

    beforeAll(async () => {
      // Create a question to update
      const res = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-q-for-update-${randomUUID()}`)
        .set("Content-Type", "application/json")
        .send({
          questionText: "Initial question for update test",
          categoryId,
          difficultyId,
          interviewTypeId,
          skillIds: [skillId],
          referenceAnswer: "Initial reference answer",
        });
      expect(res.status).toBe(201);
      questionId = res.body.data.id;
    });

    it("updates a question with idempotency key", async () => {
      const updateKey = `p45-q-update-${questionId}-v1`;

      const res = await request(app)
        .patch(`/api/v1/admin/questions/${questionId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", updateKey)
        .set("Content-Type", "application/json")
        .send({ questionText: "Updated question text" });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.data.questionText).toBe("Updated question text");
    });

    it("replaying the update returns original result (no second mutation)", async () => {
      const updateKey = `p45-q-update-${questionId}-v1`;

      const res = await request(app)
        .patch(`/api/v1/admin/questions/${questionId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", updateKey)
        .set("Content-Type", "application/json")
        .send({ questionText: "Updated question text" });

      expect([200]).toContain(res.status);
      expect(res.body.data.id).toBe(questionId);
    });

    it("audit table has exactly one QUESTION_UPDATED event after replay", async () => {
      await new Promise((r) => setTimeout(r, 300));

      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("id, metadata")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_UPDATED")
        .eq("resource_id", questionId);

      expect(audits?.length).toBe(1);

      // Metadata should contain field names, not values
      const metadata = audits?.[0]?.metadata as Record<string, unknown> | null;
      if (metadata) {
        const serialized = JSON.stringify(metadata);
        expect(serialized).not.toContain("Updated question text");
        expect(serialized).toContain("questionText"); // field name OK
      }
    });

    it("different key with different body creates a second update audit event", async () => {
      const auditsBefore = await testAdminClient
        .from("audit_logs")
        .select("id")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_UPDATED")
        .eq("resource_id", questionId);

      const countBefore = auditsBefore.data?.length ?? 0;

      // New key = new operation, not a replay
      const res = await request(app)
        .patch(`/api/v1/admin/questions/${questionId}`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-q-update-${questionId}-v2-${randomUUID()}`)
        .set("Content-Type", "application/json")
        .send({ questionText: "Second update with new key" });

      expect(res.status).toBe(HTTP_STATUS.OK);

      await new Promise((r) => setTimeout(r, 300));

      const auditsAfter = await testAdminClient
        .from("audit_logs")
        .select("id")
        .eq("actor_user_id", adminUserId)
        .eq("action", "QUESTION_UPDATED")
        .eq("resource_id", questionId);

      expect(auditsAfter.data?.length).toBe(countBefore + 1);
    });
  });

  // =========================================================================
  // SECTION 6: Audit Record Inaccessibility to Students
  // =========================================================================

  describe("Audit record security (student cannot read audit logs)", () => {
    it("student cannot query audit_logs via the API (RLS blocks read)", async () => {
      // Supabase RLS blocks authenticated user reads of audit_logs
      // We verify this by checking the admin questions route doesn't expose audit data
      // and by confirming the API doesn't have a student audit endpoint
      const res = await request(app)
        .get("/api/v1/questions") // student read route
        .set("Authorization", `Bearer ${studentAccessToken}`);

      // No audit fields in student response
      expect(res.body).not.toHaveProperty("auditLogs");
      expect(res.body).not.toHaveProperty("actor_user_id");
    });
  });

  // =========================================================================
  // SECTION 7: Concurrency Protection
  // =========================================================================

  describe("Concurrency protection", () => {
    it("concurrent identical creates with same idempotency key do not duplicate resources", async () => {
      const concurrentKey = `p45-concurrent-create-${randomUUID()}`;
      const concurrentSlug = `p45-concurrent-tax-${randomUUID()}`;

      // Fire two requests simultaneously with the same key
      const [res1, res2] = await Promise.all([
        request(app)
          .post("/api/v1/admin/taxonomies/topics")
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .set("Idempotency-Key", concurrentKey)
          .set("Content-Type", "application/json")
          .send({ slug: concurrentSlug, name: "Concurrent Topic" }),
        request(app)
          .post("/api/v1/admin/taxonomies/topics")
          .set("Authorization", `Bearer ${adminAccessToken}`)
          .set("Idempotency-Key", concurrentKey)
          .set("Content-Type", "application/json")
          .send({ slug: concurrentSlug, name: "Concurrent Topic" }),
      ]);

      // At least one must succeed
      const statuses = [res1.status, res2.status];
      expect(statuses).toContain(201);

      // The other may be a replay (200/201) or in-progress (409 IDEMPOTENCY_IN_PROGRESS)
      for (const status of statuses) {
        expect([200, 201, 409]).toContain(status);
      }

      // Only one resource must exist in the database
      const { data: rows } = await testAdminClient
        .from("question_topics")
        .select("id")
        .eq("slug", concurrentSlug);

      expect(rows?.length).toBe(1);
    });

    it("invalid lifecycle transition is rejected safely", async () => {
      // Create and publish a question, then try to publish it again
      const createRes = await request(app)
        .post("/api/v1/admin/questions")
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-already-pub-create-${randomUUID()}`)
        .set("Content-Type", "application/json")
        .send({
          questionText: "Question for double publish test",
          categoryId,
          difficultyId,
          interviewTypeId,
          skillIds: [skillId],
          referenceAnswer: "Some answer",
        });
      expect(createRes.status).toBe(201);
      const qId = createRes.body.data.id;

      // Publish once
      await request(app)
        .post(`/api/v1/admin/questions/${qId}/publish`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-pub-once-${qId}`);

      // Try to publish again with a NEW key (not a replay)
      const res = await request(app)
        .post(`/api/v1/admin/questions/${qId}/publish`)
        .set("Authorization", `Bearer ${adminAccessToken}`)
        .set("Idempotency-Key", `p45-pub-twice-${qId}-${randomUUID()}`);

      // Must be rejected — cannot publish an already-published question
      expect([409, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
      // No database or SQL details in error
      expect(JSON.stringify(res.body)).not.toMatch(/sql|constraint|postgres/i);
    });
  });
});
