import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { randomUUID } from "node:crypto";
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

describe("E2E: Interviews API (Phase 5.3)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const user1 = generateTestIdentity("int-e2e-1");
  const user2 = generateTestIdentity("int-e2e-2");

  let u1Token: string;
  let u2Token: string;

  let validInterviewTypeId: string;
  let validDifficultyId: string;
  let validSkillId: string;

  let createdInterviewId: string;
  let interviewUpdatedAt: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Create User 1
    const res1 = await testAdminClient.auth.admin.createUser({
      email: user1.email,
      password: user1.password,
      email_confirm: true,
    });
    testUsers.push(res1.data.user!.id);
    await testAdminClient.from("users").upsert({
      id: res1.data.user!.id,
      email: user1.email,
      role: "student",
      account_status: "active",
      full_name: "U1",
    });
    const login1 = await authGateway.loginWithPassword({
      email: user1.email,
      password: user1.password,
    });
    if (!login1.success) throw new Error("Failed to login U1");
    u1Token = login1.session.accessToken;

    // Create User 2
    const res2 = await testAdminClient.auth.admin.createUser({
      email: user2.email,
      password: user2.password,
      email_confirm: true,
    });
    testUsers.push(res2.data.user!.id);
    await testAdminClient.from("users").upsert({
      id: res2.data.user!.id,
      email: user2.email,
      role: "student",
      account_status: "active",
      full_name: "U2",
    });
    const login2 = await authGateway.loginWithPassword({
      email: user2.email,
      password: user2.password,
    });
    if (!login2.success) throw new Error("Failed to login U2");
    u2Token = login2.session.accessToken;

    const suffix = Date.now().toString();

    const { data: typeRes, error: typeErr } = await testAdminClient
      .from("question_interview_types")
      .insert({
        name: `E2E Test Type ${suffix}`,
        slug: `e2e-test-type-${suffix}`,
      })
      .select("id")
      .single();
    if (typeErr) throw typeErr;
    validInterviewTypeId = typeRes.id;

    const { data: diffRes, error: diffErr } = await testAdminClient
      .from("question_difficulties")
      .insert({
        name: `E2E Test Diff ${suffix}`,
        slug: `e2e-test-diff-${suffix}`,
      })
      .select("id")
      .single();
    if (diffErr) throw diffErr;
    validDifficultyId = diffRes.id;

    const { data: skillRes, error: skillErr } = await testAdminClient
      .from("question_skills")
      .insert({
        name: `E2E Test Skill ${suffix}`,
        slug: `e2e-test-skill-${suffix}`,
      })
      .select("id")
      .single();
    if (skillErr) throw skillErr;
    validSkillId = skillRes.id;
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      // Cleanup user (should cascade delete interviews)
      await cleanupTestUser(userId);
    }

    // Explicitly delete taxonomies to keep DB clean
    if (validSkillId) await testAdminClient.from("question_skills").delete().eq("id", validSkillId);
    if (validDifficultyId)
      await testAdminClient.from("question_difficulties").delete().eq("id", validDifficultyId);
    if (validInterviewTypeId)
      await testAdminClient
        .from("question_interview_types")
        .delete()
        .eq("id", validInterviewTypeId);
  });

  describe("Security and Auth boundaries", () => {
    it("should deny unauthenticated requests on all 8 routes", async () => {
      await request(app).post("/api/v1/interviews").send({}).expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app).patch("/api/v1/interviews/123").send({}).expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app).get("/api/v1/interviews").expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app).get("/api/v1/interviews/123").expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app).get("/api/v1/interviews/123/sessions").expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app)
        .get("/api/v1/interviews/123/sessions/456")
        .expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app)
        .get("/api/v1/interviews/123/sessions/456/questions")
        .expect(HTTP_STATUS.UNAUTHORIZED);
      await request(app)
        .get("/api/v1/interviews/123/sessions/456/questions/789")
        .expect(HTTP_STATUS.UNAUTHORIZED);
    });
  });

  describe("Core Interview Operations", () => {
    it("POST /api/v1/interviews should create successfully", async () => {
      const payload = {
        title: "My E2E Interview",
        targetRole: "Software Engineer",
        interviewTypeId: validInterviewTypeId,
        difficultyId: validDifficultyId,
        questionCount: 3,
        timeLimitMinutes: 30,
        skillIds: [validSkillId],
        topicIds: [],
      };

      const res = await request(app)
        .post("/api/v1/interviews")
        .set("Authorization", `Bearer ${u1Token}`)
        .send(payload)
        .expect(HTTP_STATUS.CREATED);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe(payload.title);

      createdInterviewId = res.body.data.id;
      interviewUpdatedAt = res.body.data.updatedAt;
    });

    it("PATCH /api/v1/interviews/:id should update successfully", async () => {
      if (!createdInterviewId) {
        throw new Error("Interview creation prerequisite did not complete");
      }

      const res = await request(app)
        .patch(`/api/v1/interviews/${createdInterviewId}`)
        .set("Authorization", `Bearer ${u1Token}`)
        .send({
          expectedUpdatedAt: interviewUpdatedAt,
          payload: { title: "Updated Title" },
        })
        .expect(HTTP_STATUS.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Updated Title");
      interviewUpdatedAt = res.body.data.updatedAt;
    });

    it("GET /api/v1/interviews should return collection with pagination metadata and no leakages", async () => {
      const res = await request(app)
        .get("/api/v1/interviews?page=1&limit=10")
        .set("Authorization", `Bearer ${u1Token}`)
        .expect(HTTP_STATUS.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.meta).toBeDefined();
      expect(res.body.meta.currentPage).toBe(1);

      // Leakage check
      const first = res.body.data[0];
      expect(first.user_id).toBeUndefined(); // internal DB fields stripped
      expect(first.created_at).toBeUndefined();
    });

    it("GET /api/v1/interviews/:id should return 404 for cross-owner read", async () => {
      if (!createdInterviewId) {
        throw new Error("Interview creation prerequisite did not complete");
      }

      const res = await request(app)
        .get(`/api/v1/interviews/${createdInterviewId}`)
        .set("Authorization", `Bearer ${u2Token}`)
        .expect(HTTP_STATUS.NOT_FOUND);

      expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
    });
  });

  describe("Session History and Nondisclosure", () => {
    it("GET /api/v1/interviews/:id/sessions should return sessions with pagination metadata", async () => {
      if (!createdInterviewId) {
        throw new Error("Interview creation prerequisite did not complete");
      }

      const res = await request(app)
        .get(`/api/v1/interviews/${createdInterviewId}/sessions`)
        .set("Authorization", `Bearer ${u1Token}`)
        .expect(HTTP_STATUS.OK);

      expect(res.body.success).toBe(true);
      expect(res.body.meta).toBeDefined();
      // We haven't created sessions, so it's empty, but the API contract is respected
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("GET /api/v1/interviews/:id/sessions/:sessionId/questions should enforce ready-session 409 nondisclosure", async () => {
      if (!createdInterviewId) {
        throw new Error("Interview creation prerequisite did not complete");
      }

      // To fully test 409, we'd need to mock the service layer or seed a "ready" session manually.
      // Since it's a real DB test, let's seed a ready session via testAdminClient directly.
      const sessionId = randomUUID();
      const now = new Date().toISOString();
      const { error: sessionError } = await testAdminClient.from("interview_sessions").insert({
        id: sessionId,
        interview_id: createdInterviewId,
        user_id: testUsers[0] as string,
        status: "ready",
        config_snapshot: {},
        config_snapshot_version: 1,
        total_paused_seconds: 0,
        last_transition_at: now,
        created_at: now,
        updated_at: now,
      });
      if (sessionError) {
        throw new Error(`Failed to seed interview session: ${JSON.stringify(sessionError)}`);
      }

      try {
        const res = await request(app)
          .get(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions`)
          .set("Authorization", `Bearer ${u1Token}`)
          .expect(HTTP_STATUS.CONFLICT); // Expect HTTP 409 Conflict

        expect(res.body.code).toBe("RESOURCE_CONFLICT");
      } finally {
        // Clean up the seeded session to keep DB pristine
        await testAdminClient.from("interview_sessions").delete().eq("id", sessionId);
      }
    });

    it("GET /api/v1/interviews/:id/sessions/:sessionId/questions/:sessionQuestionId should return 404 for unknown resources", async () => {
      if (!createdInterviewId) {
        throw new Error("Interview creation prerequisite did not complete");
      }

      await request(app)
        .get(
          `/api/v1/interviews/${createdInterviewId}/sessions/00000000-0000-0000-0000-000000000000/questions/00000000-0000-0000-0000-000000000000`,
        )
        .set("Authorization", `Bearer ${u1Token}`)
        .expect(HTTP_STATUS.NOT_FOUND);
    });
  });

  describe("Lifecycle API Endpoints", () => {
    let sessionId: string;
    beforeAll(async () => {
      // Seed a session for lifecycle tests
      sessionId = randomUUID();
      const now = new Date().toISOString();
      await testAdminClient.from("interview_sessions").insert({
        id: sessionId,
        interview_id: createdInterviewId,
        user_id: testUsers[0] as string,
        status: "ready",
        config_snapshot: {},
        config_snapshot_version: 1,
        total_paused_seconds: 0,
        last_transition_at: now,
        created_at: now,
        updated_at: now,
      });
    });

    afterAll(async () => {
      await testAdminClient.from("interview_sessions").delete().eq("id", sessionId);
    });

    it("POST /api/v1/interviews/:id/sessions/:sessionId/start should reject invalid bodies", async () => {
      // Null body
      await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "start-key-invalid-1")
        .set("Content-Type", "application/json")
        .send(null as any)
        .expect(400);

      // Malformed JSON
      await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "start-key-invalid-json")
        .set("Content-Type", "application/json")
        .send("{bad_json")
        .expect(400);

      // Unknown field
      await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "start-key-invalid-2")
        .set("Content-Type", "application/json")
        .send({ unknownField: "bad" })
        .expect(422);

      // Missing Idempotency-Key
      await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Content-Type", "application/json")
        .send({})
        .expect(422);

      // Invalid UUID
      await request(app)
        .post(`/api/v1/interviews/invalid-uuid/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "start-key-invalid-3")
        .set("Content-Type", "application/json")
        .send({})
        .expect(422);
    });

    it("POST /api/v1/interviews/:id/sessions/:sessionId/start should start session and replay", async () => {
      const idempotencyKey = "start-key-123";

      const res = await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", idempotencyKey)
        .set("Content-Type", "application/json")
        .send({})
        .expect(HTTP_STATUS.OK);

      expect(res.body.data.status).toBe("in_progress");
      expect(res.header["x-idempotency-replay"]).toBeUndefined();

      // Test replay
      const replay = await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/start`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", idempotencyKey)
        .set("Content-Type", "application/json")
        .send({})
        .expect(HTTP_STATUS.OK);

      expect(replay.header["x-idempotency-replay"]).toBe("true");
      expect(replay.body.data.status).toBe("in_progress");
    });

    it("POST /api/v1/interviews/:id/sessions/:sessionId/pause should pause session", async () => {
      const res = await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/pause`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "pause-key-123")
        .set("Content-Type", "application/json")
        .send({})
        .expect(HTTP_STATUS.OK);

      expect(res.body.data.status).toBe("paused");
      expect(res.body.data.pausedAt).toBeDefined();
    });

    it("POST /api/v1/interviews/:id/sessions/:sessionId/resume should resume session", async () => {
      const res = await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/resume`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "resume-key-123")
        .set("Content-Type", "application/json")
        .send({})
        .expect(HTTP_STATUS.OK);

      expect(res.body.data.status).toBe("in_progress");
    });

    it("POST /api/v1/interviews/:id/sessions/:sessionId/complete should complete session", async () => {
      const res = await request(app)
        .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/complete`)
        .set("Authorization", `Bearer ${u1Token}`)
        .set("Idempotency-Key", "complete-key-123")
        .set("Content-Type", "application/json")
        .send({})
        .expect(HTTP_STATUS.OK);

      expect(res.body.data.status).toBe("completed");
      expect(res.body.data.completedAt).toBeDefined();
    });
  });
});
