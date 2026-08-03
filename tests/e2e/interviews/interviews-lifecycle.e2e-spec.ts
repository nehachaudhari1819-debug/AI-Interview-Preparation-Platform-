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
import { ERROR_CODES } from "../../../src/constants/error-codes.constants.js";

describe("E2E: Interviews Lifecycle (Phase 6.3)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });
  const user1 = generateTestIdentity("lifecycle-e2e-1");
  const user2 = generateTestIdentity("lifecycle-e2e-2");

  let u1Token: string;
  let u2Token: string;

  let validInterviewTypeId: string;
  let validDifficultyId: string;
  let validSkillId: string;

  let createdInterviewId: string;
  let sessionId: string;
  let question1Id: string;
  let question2Id: string;

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
      full_name: "U1 Lifecycle",
    });
    const login1 = await authGateway.loginWithPassword({
      email: user1.email,
      password: user1.password,
    });
    u1Token = login1.session!.accessToken;

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
      full_name: "U2 Lifecycle",
    });
    const login2 = await authGateway.loginWithPassword({
      email: user2.email,
      password: user2.password,
    });
    u2Token = login2.session!.accessToken;

    const suffix = Date.now().toString();

    const { data: typeRes } = await testAdminClient
      .from("question_interview_types")
      .insert({ name: `E2E Type ${suffix}`, slug: `e2e-type-${suffix}` })
      .select("id")
      .single();
    validInterviewTypeId = typeRes!.id;

    const { data: diffRes } = await testAdminClient
      .from("question_difficulties")
      .insert({ name: `E2E Diff ${suffix}`, slug: `e2e-diff-${suffix}` })
      .select("id")
      .single();
    validDifficultyId = diffRes!.id;

    const { data: skillRes } = await testAdminClient
      .from("question_skills")
      .insert({ name: `E2E Skill ${suffix}`, slug: `e2e-skill-${suffix}` })
      .select("id")
      .single();
    validSkillId = skillRes!.id;
  });

  afterAll(async () => {
    for (const uid of testUsers) {
      await cleanupTestUser(uid);
    }
    await testAdminClient.from("question_skills").delete().eq("id", validSkillId);
    await testAdminClient.from("question_difficulties").delete().eq("id", validDifficultyId);
    await testAdminClient.from("question_interview_types").delete().eq("id", validInterviewTypeId);
    
    server.close();
  });

  it("should create interview and start session", async () => {
    // 1. Create Interview
    const createRes = await request(app)
      .post("/api/v1/interviews")
      .set("Authorization", `Bearer ${u1Token}`)
      .send({
        title: "Lifecycle E2E",
        targetRole: "Tester",
        interviewTypeId: validInterviewTypeId,
        difficultyId: validDifficultyId,
        questionCount: 2,
        timeLimitMinutes: 30,
        skillIds: [validSkillId],
      });
    expect(createRes.status).toBe(201);
    createdInterviewId = createRes.body.data.id;

    // 2. Start Session
    const sessionRes = await request(app)
      .post(`/api/v1/interviews/${createdInterviewId}/sessions`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", randomUUID());
    expect(sessionRes.status).toBe(201);
    sessionId = sessionRes.body.data.id;

    // 3. Inject mock questions via admin client because question generation logic might not be fully wired in E2E mock
    const { data: q1 } = await testAdminClient
      .from("interview_session_questions")
      .insert({ session_id: sessionId, display_order: 1, question_text_snapshot: "Q1", taxonomy_snapshot: {} })
      .select("id")
      .single();
    const { data: q2 } = await testAdminClient
      .from("interview_session_questions")
      .insert({ session_id: sessionId, display_order: 2, question_text_snapshot: "Q2", taxonomy_snapshot: {} })
      .select("id")
      .single();
      
    question1Id = q1!.id;
    question2Id = q2!.id;
  });

  it("should block U2 from mutating U1's session (Ownership)", async () => {
    const res = await request(app)
      .put(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer`)
      .set("Authorization", `Bearer ${u2Token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ responseType: "text", textResponse: "Hacker" });

    // Assuming the service uses DB policies or checks ownership, should yield 403 or 404
    expect([403, 404]).toContain(res.status);
  });

  it("should save draft and replay successfully (Idempotency)", async () => {
    const ik = randomUUID();
    const payload = { responseType: "text", textResponse: "Draft 1" };

    // Initial Save
    const res1 = await request(app)
      .put(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", ik)
      .send(payload);
    
    expect(res1.status).toBe(201);
    expect(res1.body.data.status).toBe("draft");
    expect(res1.body.data.version).toBe(1);

    // Exact Replay
    const res2 = await request(app)
      .put(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", ik)
      .send(payload);
      
    expect(res2.status).toBe(200); // Because it's replayed, it might be 200 or 201, controller returns 201 for PUT, but replayed might be 200/201 depending on mapping
    expect(res2.body.meta.replayed).toBe(true);

    // Fingerprint Mismatch (Idempotency conflict)
    const res3 = await request(app)
      .put(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", ik)
      .send({ responseType: "text", textResponse: "Different" });
      
    expect(res3.status).toBe(409);
    expect(res3.body.code).toBe(ERROR_CODES.RESOURCE_CONFLICT);
  });

  it("should fail concurrent update attempts (CAS version checks)", async () => {
    // Attempt update with old version (0)
    const res = await request(app)
      .patch(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ responseType: "text", textResponse: "Stale", expectedVersion: 0 }); // Current version is 1
      
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ERROR_CODES.STALE_UPDATE_CONFLICT);
  });

  it("should successfully finalize answer", async () => {
    const res = await request(app)
      .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question1Id}/answer/finalize`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ expectedVersion: 1 });
      
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("finalized");
    expect(res.body.data.version).toBe(1);
  });

  it("should auto-skip remaining questions on complete session (Auto-Skipping)", async () => {
    const res = await request(app)
      .post(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/complete`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", randomUUID())
      .send({});
      
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("completed");
    
    // Ensure Question 2 was auto-skipped
    const { data: q2Answer } = await testAdminClient
      .from("interview_session_answers")
      .select("*")
      .eq("session_question_id", question2Id)
      .single();
      
    expect(q2Answer).toBeDefined();
    expect(q2Answer!.status).toBe("skipped");
    expect(q2Answer!.skipped_at).not.toBeNull();
  });

  it("should block mutations on completed session (Terminal State)", async () => {
    // Try to save draft on completed session for question 2
    const res = await request(app)
      .put(`/api/v1/interviews/${createdInterviewId}/sessions/${sessionId}/questions/${question2Id}/answer`)
      .set("Authorization", `Bearer ${u1Token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ responseType: "text", textResponse: "Late" });
      
    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ERROR_CODES.SESSION_TERMINAL);
  });
});
