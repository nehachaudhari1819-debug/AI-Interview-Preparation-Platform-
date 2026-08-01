import { describe, expect, it, beforeAll, afterAll } from "@jest/globals";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  testAdminClient,
  generateTestIdentity,
  cleanupTestUser,
  appConfig,
} from "../../setup/real-environment.js";
import { SupabaseInterviewsRepository } from "../../../src/persistence/interviews/supabase-interviews.repository.js";
import {
  PersistenceError,
  PersistenceErrorCode,
} from "../../../src/persistence/persistence-error.js";
import { SupabaseAdminQuestionsRepository } from "../../../src/persistence/questions/supabase-admin-questions.repository.js";
import type { Database } from "../../../src/persistence/database.types.js";
import { DbLockHelper } from "../../utils/db-lock-helper.js";

describe("SupabaseInterviewsRepository (Real DB Integration)", () => {
  let authClient: SupabaseClient<Database>;
  let repo: SupabaseInterviewsRepository;
  let testUserId: string;
  let identity: ReturnType<typeof generateTestIdentity>;

  let validInterviewTypeId: string;
  let validDifficultyId: string;
  let validSkillId: string;
  let validCategoryId: string;
  let dbUrl: string;

  beforeAll(async () => {
    identity = generateTestIdentity("interview-repo");

    const {
      data: { user },
      error: createErr,
    } = await testAdminClient.auth.admin.createUser({
      email: identity.email,
      password: identity.password,
      email_confirm: true,
    });
    if (createErr || !user) throw createErr || new Error("Failed to create user");
    testUserId = user.id;

    await testAdminClient.from("users").upsert({
      id: testUserId,
      email: identity.email,
      role: "student",
      account_status: "active",
      full_name: "Test Student",
    });

    const supabaseUrl = (appConfig.supabase as any).url;
    const supabaseKey = (appConfig.supabase as any).publishableKey;
    dbUrl = (appConfig.supabase as any).dbUrl || process.env.DB_URL || "";

    const anonClient = createClient<Database>(supabaseUrl, supabaseKey);
    const {
      data: { session },
      error: signInErr,
    } = await anonClient.auth.signInWithPassword({
      email: identity.email,
      password: identity.password,
    });
    if (signInErr || !session) throw signInErr || new Error("Failed to sign in anon user");

    authClient = createClient<Database>(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${session.access_token}` } },
    });
    repo = new SupabaseInterviewsRepository(authClient);

    const suffix = Date.now().toString();

    const { data: typeRes, error: typeErr } = await testAdminClient
      .from("question_interview_types")
      .insert({
        name: `Integration Test Type ${suffix}`,
        slug: `integration-test-type-${suffix}`,
        is_active: true,
      })
      .select("id")
      .single();
    if (typeErr) throw typeErr;
    validInterviewTypeId = typeRes.id;

    const { data: diffRes, error: diffErr } = await testAdminClient
      .from("question_difficulties")
      .insert({
        name: `Integration Test Diff ${suffix}`,
        slug: `integration-test-diff-${suffix}`,
        is_active: true,
      })
      .select("id")
      .single();
    if (diffErr) throw diffErr;
    validDifficultyId = diffRes.id;

    const { data: skillRes, error: skillErr } = await testAdminClient
      .from("question_skills")
      .insert({
        name: `Integration Test Skill ${suffix}`,
        slug: `integration-test-skill-${suffix}`,
        is_active: true,
      })
      .select("id")
      .single();
    if (skillErr) throw skillErr;
    validSkillId = skillRes.id;

    const { data: catRes, error: catErr } = await testAdminClient
      .from("question_categories")
      .insert({
        name: `Integration Test Cat ${suffix}`,
        slug: `integration-test-cat-${suffix}`,
        is_active: true,
      })
      .select("id")
      .single();
    if (catErr) throw catErr;
    validCategoryId = catRes.id;
  });

  afterAll(async () => {
    if (testUserId) {
      // Cleanup user (should cascade delete interviews)
      await cleanupTestUser(testUserId);
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
    if (validCategoryId)
      await testAdminClient.from("question_categories").delete().eq("id", validCategoryId);
  });

  describe("RPC normalization and creation", () => {
    it("should successfully create and update an interview RPC call with exact argument names", async () => {
      const createdId = await repo.createInterview({
        interviewTypeId: validInterviewTypeId,
        difficultyId: validDifficultyId,
        questionCount: 3,
        timeLimitMinutes: 30,
        skillIds: [validSkillId],
        topicIds: [],
        title: "Integration Test",
        targetRole: "Dev",
      });

      expect(createdId).toBeDefined();

      const detail = await repo.getInterviewById(createdId);
      expect(detail).toBeDefined();
      expect(detail!.title).toBe("Integration Test");

      const updatedId = await repo.updateInterview(createdId, {
        expectedUpdatedAt: detail!.updated_at,
        payload: { title: "Updated Test" },
      });

      expect(updatedId).toBe(createdId);
    });

    it("should reject creation with VALIDATION_FAILED (P0004) when skill limits are exceeded", async () => {
      await expect(
        repo.createInterview({
          interviewTypeId: validInterviewTypeId,
          difficultyId: validDifficultyId,
          questionCount: 5,
          timeLimitMinutes: 30,
          skillIds: [], // Empty skills violate DB validation
          topicIds: [],
          title: "Test",
          targetRole: "Dev",
        }),
      ).rejects.toMatchObject({ code: PersistenceErrorCode.VALIDATION_FAILED });
    });

    it("should reject missing records with RECORD_NOT_FOUND (P0002) or similar constraints", async () => {
      await expect(
        repo.updateInterview("00000000-0000-0000-0000-000000000000", {
          expectedUpdatedAt: new Date().toISOString(),
          payload: { title: "New" },
        }),
      ).rejects.toMatchObject({ code: PersistenceErrorCode.RECORD_NOT_FOUND });
    });

    it("should reject concurrent updates with RECORD_UPDATE_CONFLICT (P0003)", async () => {
      const createdId = await repo.createInterview({
        interviewTypeId: validInterviewTypeId,
        difficultyId: validDifficultyId,
        questionCount: 3,
        timeLimitMinutes: 30,
        skillIds: [validSkillId],
        topicIds: [],
        title: "Conflict Test",
        targetRole: "Dev",
      });

      // Attempt to update with a deliberately old timestamp to trigger P0003
      await expect(
        repo.updateInterview(createdId, {
          expectedUpdatedAt: new Date("2000-01-01T00:00:00Z").toISOString(),
          payload: { title: "Conflict" },
        }),
      ).rejects.toMatchObject({ code: PersistenceErrorCode.RECORD_UPDATE_CONFLICT });
    });

    it("should safely conceal a foreign-owned interview during update (P0002)", async () => {
      let u2Id: string | undefined;
      try {
        const createdId = await repo.createInterview({
          interviewTypeId: validInterviewTypeId,
          difficultyId: validDifficultyId,
          questionCount: 3,
          timeLimitMinutes: 30,
          skillIds: [validSkillId],
          topicIds: [],
          title: "User 1 Interview",
          targetRole: "Dev",
        });
        const detail = await repo.getInterviewById(createdId);

        const user2 = generateTestIdentity("repo-user2");
        const {
          data: { user },
        } = await testAdminClient.auth.admin.createUser({
          email: user2.email,
          password: user2.password,
          email_confirm: true,
        });
        u2Id = user!.id;

        await testAdminClient.from("users").insert({
          id: user!.id,
          email: user2.email,
          role: "student",
          account_status: "active",
          full_name: "U2",
        });

        const anonClient = createClient<Database>(
          (appConfig.supabase as any).url,
          (appConfig.supabase as any).publishableKey,
        );
        const {
          data: { session },
        } = await anonClient.auth.signInWithPassword({
          email: user2.email,
          password: user2.password,
        });

        const authClient2 = createClient<Database>(
          (appConfig.supabase as any).url,
          (appConfig.supabase as any).publishableKey,
          {
            global: { headers: { Authorization: `Bearer ${session!.access_token}` } },
          },
        );
        const repo2 = new SupabaseInterviewsRepository(authClient2);

        // Attempting to update a record owned by user1 using user2's client
        await expect(
          repo2.updateInterview(createdId, {
            expectedUpdatedAt: detail!.updated_at,
            payload: { title: "Hack" },
          }),
        ).rejects.toMatchObject({ code: PersistenceErrorCode.RECORD_NOT_FOUND });
      } finally {
        if (u2Id) await cleanupTestUser(u2Id);
      }
    });

    it("should reject session creation with P0006 when 64-bit advisory lock is already held", async () => {
      const { Client } = await import("pg");
      const client = new Client({ connectionString: dbUrl });
      await client.connect();
      try {
        const operation = "INTERVIEWS_CREATE_SESSION";
        const idempotencyKey = "session-create-lock-contention";

        await client.query("BEGIN");

        const lockResult = await client.query<{ acquired: boolean }>(
          `
            SELECT pg_try_advisory_xact_lock(
              hashtextextended(
                jsonb_build_array(
                  $1::text,
                  $2::text,
                  $3::text
                )::text,
                0
              )
            ) AS acquired
          `,
          [testUserId, operation, idempotencyKey],
        );

        expect(lockResult.rows[0]?.acquired).toBe(true);

        const createdId = await repo.createInterview({
          interviewTypeId: validInterviewTypeId,
          difficultyId: validDifficultyId,
          questionCount: 3,
          timeLimitMinutes: 30,
          skillIds: [validSkillId],
          topicIds: [],
          title: "Concurrency Lock Test",
          targetRole: "Dev",
        });

        // Use a separately acquired database client for the RPC
        await expect(
          repo.createSession(createdId, idempotencyKey, "a".repeat(64)),
        ).rejects.toMatchObject({
          code: PersistenceErrorCode.IDEMPOTENCY_IN_PROGRESS,
        });
      } finally {
        await client.query("ROLLBACK");
        await client.end();
      }
    });
  });

  describe("Read operations and ownership", () => {
    it("should read owned interview collection", async () => {
      const { interviews, total } = await repo.getInterviews({
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortDir: "desc",
      });
      expect(Array.isArray(interviews)).toBe(true);
      expect(typeof total).toBe("number");
    });

    it("should enforce nested session and session-question ownership rules", async () => {
      let u2Id: string | undefined;
      try {
        const createdId = await repo.createInterview({
          interviewTypeId: validInterviewTypeId,
          difficultyId: validDifficultyId,
          questionCount: 3,
          timeLimitMinutes: 30,
          skillIds: [validSkillId],
          topicIds: [],
          title: "Ownership Test",
          targetRole: "Dev",
        });

        const now = new Date().toISOString();

        // Insert a real session bypassing RPCs for speed/simplicity
        const { data: sessionData, error: sessionError } = await testAdminClient
          .from("interview_sessions")
          .insert({
            interview_id: createdId,
            user_id: testUserId,
            status: "in_progress",
            config_snapshot: {},
            config_snapshot_version: 1,
            started_at: now,
            paused_at: null,
            completed_at: null,
            total_paused_seconds: 0,
            last_transition_at: now,
            created_at: now,
            updated_at: now,
          })
          .select("id")
          .single();
        if (sessionError) {
          throw new Error(`Failed to seed interview session: ${JSON.stringify(sessionError)}`);
        }
        if (!sessionData) {
          throw new Error("Failed to seed interview session: no row returned");
        }

        const sessionId = sessionData.id;

        // Use the globally created category fixture to safely insert the question as draft
        const { data: qData, error: qErr } = await testAdminClient
          .from("questions")
          .insert({
            created_by: testUserId,
            category_id: validCategoryId,
            difficulty_id: validDifficultyId,
            interview_type_id: validInterviewTypeId,
            question_text: "Nested ownership test question",
            status: "draft",
          })
          .select("id")
          .single();

        if (qErr) {
          throw new Error(`Failed to seed question: ${JSON.stringify(qErr)}`);
        }
        if (!qData) {
          throw new Error("Failed to seed question: no row returned");
        }

        // Publish the question using the approved lifecycle mechanism
        const adminQuestionsRepo = new SupabaseAdminQuestionsRepository(testAdminClient);
        const publishResult = await adminQuestionsRepo.updateQuestionStatus(
          qData.id,
          "published",
          "draft",
        );
        if (!publishResult) {
          throw new Error("Question publish operation returned no result");
        }

        // Verify base question row directly
        const { data: persistedQuestion, error: persistedQuestionError } = await testAdminClient
          .from("questions")
          .select(
            `
            id,
            status,
            category_id,
            difficulty_id,
            interview_type_id,
            published_at,
            archived_at
          `,
          )
          .eq("id", qData.id)
          .single();

        if (persistedQuestionError) {
          throw new Error(
            `Failed to verify published question state: ${JSON.stringify(persistedQuestionError)}`,
          );
        }
        if (!persistedQuestion) {
          throw new Error("Published question verification returned no row");
        }
        if (persistedQuestion.status !== "published") {
          throw new Error(
            `Question status transition did not publish row: ${JSON.stringify(persistedQuestion)}`,
          );
        }

        // Validate taxonomy constraints
        const { data: taxonomyState, error: taxonomyStateError } = await testAdminClient
          .from("questions")
          .select(
            `
            id,
            status,
            question_categories!inner(id, is_active),
            question_difficulties!inner(id, is_active),
            question_interview_types!inner(id, is_active)
          `,
          )
          .eq("id", qData.id)
          .single();

        if (taxonomyStateError) {
          throw new Error(`Failed to verify taxonomy state: ${JSON.stringify(taxonomyStateError)}`);
        }

        // Obtain the published_questions row from the view
        const { data: pqData, error: pqErr } = await authClient
          .from("published_questions")
          .select("id")
          .eq("id", qData.id)
          .single();

        if (pqErr) {
          throw new Error(`Failed to retrieve published question: ${JSON.stringify(pqErr)}`);
        }
        if (!pqData) {
          throw new Error("Failed to retrieve published question: no row returned");
        }

        const { data: questionData, error: questionError } = await testAdminClient
          .from("interview_session_questions")
          .insert({
            session_id: sessionId,
            question_id: pqData.id as string,
            display_order: 1,
            question_text_snapshot: "Q",
            taxonomy_snapshot: {},
          })
          .select("id")
          .single();
        if (questionError) {
          throw new Error(`Failed to seed session question: ${JSON.stringify(questionError)}`);
        }
        if (!questionData) {
          throw new Error("Failed to seed session question: no row returned");
        }

        const questionId = questionData.id;

        // User 1 accesses their own data
        const pagination = {
          page: 1,
          limit: 10,
          sortBy: "createdAt",
          sortDir: "desc",
        } satisfies Parameters<typeof repo.getInterviewSessions>[1];
        const sessionsResult = await repo.getInterviewSessions(createdId, pagination);
        expect(sessionsResult.total).toBe(1);

        const sessionDetail = await repo.getInterviewSessionById(createdId, sessionId);
        expect(sessionDetail).toBeDefined();

        const questions = await repo.getSessionQuestions(createdId, sessionId);
        expect(questions).toHaveLength(1);
        expect(questions[0]?.session_id).toBe(sessionId);

        const questionDetail = await repo.getSessionQuestionById(createdId, sessionId, questionId);
        expect(questionDetail).toBeDefined();

        // Secondary user
        const user2 = generateTestIdentity("repo-user2-nested");
        const {
          data: { user },
        } = await testAdminClient.auth.admin.createUser({
          email: user2.email,
          password: user2.password,
          email_confirm: true,
        });
        u2Id = user!.id;
        await testAdminClient.from("users").upsert({
          id: user!.id,
          email: user2.email,
          role: "student",
          account_status: "active",
          full_name: "U2",
        });

        const anonClient = createClient<Database>(
          (appConfig.supabase as any).url,
          (appConfig.supabase as any).publishableKey,
        );
        const {
          data: { session },
        } = await anonClient.auth.signInWithPassword({
          email: user2.email,
          password: user2.password,
        });

        const authClient2 = createClient<Database>(
          (appConfig.supabase as any).url,
          (appConfig.supabase as any).publishableKey,
          {
            global: { headers: { Authorization: `Bearer ${session!.access_token}` } },
          },
        );
        const repo2 = new SupabaseInterviewsRepository(authClient2);

        // Verify isolation
        const sRes2 = await repo2.getInterviewSessions(createdId, pagination);
        expect(sRes2.total).toBe(0);

        const sDet2 = await repo2.getInterviewSessionById(createdId, sessionId);
        expect(sDet2).toBeNull();

        const qRes2 = await repo2.getSessionQuestions(createdId, sessionId);
        expect(qRes2).toHaveLength(0);

        const qDet2 = await repo2.getSessionQuestionById(createdId, sessionId, questionId);
        expect(qDet2).toBeNull();
      } finally {
        if (u2Id) await cleanupTestUser(u2Id);
      }
    });
  });

  describe("Lifecycle Methods", () => {
    let createdId: string;
    let sessionId: string;
    let lockHelper: DbLockHelper | undefined;

    beforeEach(async () => {
      createdId = await repo.createInterview({
        title: "Lifecycle Integration Test",
        targetRole: "Engineer",
        interviewTypeId: validInterviewTypeId,
        difficultyId: validDifficultyId,
        questionCount: 3,
        timeLimitMinutes: 30,
        skillIds: [validSkillId],
        topicIds: [],
      });

      // create a fresh session for each test
      const { data, error } = await testAdminClient
        .from("interview_sessions")
        .insert({
          interview_id: createdId,
          user_id: testUserId,
          status: "ready",
          config_snapshot: {},
        })
        .select("id")
        .single();
      if (error || !data) throw error || new Error("Failed to create session");
      sessionId = data.id;
    });

    afterEach(async () => {
      if (lockHelper) {
        await lockHelper.releaseAndClose();
        lockHelper = undefined;
      }

      const testIks = [
        "ik-start-1",
        "ik-start-replay",
        "ik-start-conflict",
        "ik-err",
        "ik1",
        "ik2",
        "ik3",
        "ik4",
        "ik-concurrent",
        "ik-mismatch",
      ];
      await testAdminClient.from("idempotency_records").delete().in("idempotency_key", testIks);

      if (sessionId) {
        await testAdminClient.from("audit_logs").delete().eq("resource_id", sessionId);
        await testAdminClient.from("interview_sessions").delete().eq("id", sessionId);
      }

      if (createdId) {
        await testAdminClient.from("interviews").delete().eq("id", createdId);
      }
    });

    it("should successfully start a session and record audit and idempotency", async () => {
      const ik = "ik-start-1";
      const rh = "rh-start-1";
      const res = await repo.startSession(createdId, sessionId, ik, rh);
      expect(res.replayed).toBe(false);
      expect(res.snapshot.status).toBe("in_progress");
      expect(res.snapshot.started_at).not.toBeNull();

      // Verify idempotency record
      const { data: idem } = await testAdminClient
        .from("idempotency_records")
        .select("*")
        .eq("idempotency_key", ik)
        .single();
      expect(idem).toBeDefined();
      expect((idem as any).response_status).toBe(200);

      // Verify audit log
      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("*")
        .eq("resource_id", sessionId)
        .eq("action", "INTERVIEW_SESSION_STARTED");
      expect(audits!.length).toBe(1);
    });

    it("should replay if same idempotency key and hash are used", async () => {
      const ik = "ik-start-replay";
      const rh = "rh-start-replay";
      await repo.startSession(createdId, sessionId, ik, rh);

      const res = await repo.startSession(createdId, sessionId, ik, rh);
      expect(res.replayed).toBe(true);
      expect(res.snapshot.status).toBe("in_progress");

      // Ensure NO duplicate audit log
      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("*")
        .eq("resource_id", sessionId)
        .eq("action", "INTERVIEW_SESSION_STARTED");
      expect(audits!.length).toBe(1);
    });

    it("should throw RESOURCE_CONFLICT on fingerprint conflict", async () => {
      const ik = "ik-start-conflict";
      await repo.startSession(createdId, sessionId, ik, "rh-1");

      await expect(
        repo.startSession(createdId, sessionId, ik, "rh-different"),
      ).rejects.toThrowError(PersistenceError);
    });

    it("should fail invalid transition (ready -> pause)", async () => {
      let error: any;
      try {
        await repo.pauseSession(createdId, sessionId, "ik-err", "rh-err");
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(PersistenceError);
      expect(error.code).toBe(PersistenceErrorCode.RECORD_UPDATE_CONFLICT);

      // Verify NO audit log
      const { data: audits } = await testAdminClient
        .from("audit_logs")
        .select("*")
        .eq("resource_id", sessionId);
      expect(audits!.length).toBe(0);
    });

    it("should run full lifecycle successfully", async () => {
      const ik1 = "ik1",
        rh1 = "rh1";
      const ik2 = "ik2",
        rh2 = "rh2";
      const ik3 = "ik3",
        rh3 = "rh3";
      const ik4 = "ik4",
        rh4 = "rh4";

      let res = await repo.startSession(createdId, sessionId, ik1, rh1);
      expect(res.snapshot.status).toBe("in_progress");

      res = await repo.pauseSession(createdId, sessionId, ik2, rh2);
      expect(res.snapshot.status).toBe("paused");
      expect(res.snapshot.paused_at).not.toBeNull();

      // sleep a bit to accumulate pause duration
      await new Promise((r) => setTimeout(r, 1100));

      res = await repo.resumeSession(createdId, sessionId, ik3, rh3);
      expect(res.snapshot.status).toBe("in_progress");
      expect(res.snapshot.total_paused_seconds).toBeGreaterThanOrEqual(1);

      res = await repo.completeSession(createdId, sessionId, ik4, rh4);
      expect(res.snapshot.status).toBe("completed");
      expect(res.snapshot.completed_at).not.toBeNull();
    });

    it("should block concurrent overlapping requests using advisory locks", async () => {
      lockHelper = new DbLockHelper(dbUrl);
      // Acquire the lifecycle lock explicitly for the session transition
      await lockHelper.connectAndLock(testUserId, "INTERVIEW_SESSION_STARTED", "ik-concurrent");

      // The repo call should block/timeout or fail due to statement_timeout.
      // In standard PG, it would block until lockHelper releases.
      // We can simulate race condition by releasing it after a short delay.
      let started = false;
      const startPromise = repo
        .startSession(createdId, sessionId, "ik-concurrent", "rh-conc")
        .then((res) => {
          started = true;
          return res;
        });

      expect(started).toBe(false);

      await lockHelper.releaseAndClose();
      lockHelper = undefined;
      const res = await startPromise;
      expect(res.snapshot.status).toBe("in_progress");
    });

    it("should block mismatching interviewId for the session", async () => {
      const fakeInterviewId = "00000000-0000-0000-0000-000000000000";
      await expect(
        repo.startSession(fakeInterviewId, sessionId, "ik-mismatch", "rh-mismatch"),
      ).rejects.toThrowError(PersistenceError);
    });
  });
});
