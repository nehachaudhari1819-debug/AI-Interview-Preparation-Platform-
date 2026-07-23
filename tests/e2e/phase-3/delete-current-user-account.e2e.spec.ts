import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import request from "supertest";
import { type Express } from "express";
import { type Server } from "node:http";
import {
  appConfig,
  createTestApp,
  generateTestIdentity,
  cleanupTestUser,
  testAdminClient,
} from "../../setup/real-environment.js";
import { createSupabaseAuthGateway } from "../../../src/features/auth/supabase-auth-gateway.js";

describe("Phase 3.5: DELETE /api/v1/users/me (Account Deactivation)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];
  const authGateway = createSupabaseAuthGateway({ config: appConfig });

  beforeAll(async () => {
    const { app: testApp, server: testServer } = createTestApp();
    app = testApp;
    server = testServer;
  });

  afterAll(async () => {
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
    server.close();
  });

  it("should successfully soft-delete an account and be idempotent", async () => {
    // 1. Create a user
    const identity = generateTestIdentity("me-api-del");

    const result = await authGateway.registerWithPassword({
      email: identity.email,
      password: identity.password,
      emailRedirectTo: "http://localhost:3000/callback",
    });
    if (!result.success || !result.session)
      throw new Error("Failed to register test user: " + JSON.stringify(result));
    const session = result.session;

    testUsers.push(session.user.id);
    // We need to mark the profile active for the test
    await testAdminClient
      .from("users")
      .update({ account_status: "active" })
      .eq("id", session.user.id);

    const idempotencyKey = "test-delete-key-" + Date.now();

    // 2. Perform soft deletion concurrently to test idempotency and 200 replay
    // To avoid the 401 Unauthorized from the revoked session in a sequential request,
    // we fire two identical requests concurrently. The backend must serialize them,
    // process one, and safely replay/process the other to return a 200 OK.
    const concurrentRes = await Promise.all([
      request(app)
        .delete("/api/v1/users/me")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .set("X-Request-ID", "00000000-0000-0000-0000-000000000001"),
      request(app)
        .delete("/api/v1/users/me")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .set("Idempotency-Key", idempotencyKey)
        .set("X-Request-ID", "00000000-0000-0000-0000-000000000002"),
    ]);

    expect(concurrentRes[0].statusCode).toBe(200);
    expect(concurrentRes[1].statusCode).toBe(200);

    // Ensure at least one response cleared the cookie
    const setCookie1 = concurrentRes[0].headers["set-cookie"] as string[] | undefined;
    const setCookie2 = concurrentRes[1].headers["set-cookie"] as string[] | undefined;
    const hasClearedCookie =
      setCookie1?.some((c) => c.includes("Max-Age=0") || c.includes("Expires=")) ||
      setCookie2?.some((c) => c.includes("Max-Age=0") || c.includes("Expires="));
    expect(hasClearedCookie).toBe(true);

    expect(concurrentRes[0].body.success).toBe(true);
    expect(concurrentRes[0].body.data.account.status).toBe("deleted");
    expect(concurrentRes[1].body.success).toBe(true);
    expect(concurrentRes[1].body.data.account.status).toBe("deleted");

    // 3. Verify in DB via Admin client
    const { data: dbProfile } = await testAdminClient
      .from("users")
      .select("account_status, deleted_at")
      .eq("id", session.user.id)
      .single();

    expect(dbProfile?.account_status).toBe("deleted");
    expect(dbProfile?.deleted_at).toBeTruthy();

    // 4. Verify Audit Log was written exactly once despite two requests
    const { data: auditLogs } = await testAdminClient
      .from("audit_logs")
      .select("*")
      .eq("resource_id", session.user.id)
      .eq("action", "ACCOUNT_DEACTIVATED");

    expect(auditLogs).toHaveLength(1);

    // 6. Test idempotency key scoping (different user, same key is treated as new request)
    const identity2 = generateTestIdentity("me-api-del-2");

    const result2 = await authGateway.registerWithPassword({
      email: identity2.email,
      password: identity2.password,
      emailRedirectTo: "http://localhost:3000/callback",
    });
    if (!result2.success || !result2.session) throw new Error("Failed to register test user 2");
    const otherSession = result2.session;

    testUsers.push(otherSession.user.id);

    const res3 = await request(app)
      .delete("/api/v1/users/me")
      .set("Authorization", `Bearer ${otherSession.accessToken}`) // different user, same key
      .set("Idempotency-Key", idempotencyKey)
      .expect(200);

    expect(res3.body.success).toBe(true);
  });

  it("should fail if no idempotency key is provided", async () => {
    const identity3 = generateTestIdentity("me-api-del-3");

    const result3 = await authGateway.registerWithPassword({
      email: identity3.email,
      password: identity3.password,
      emailRedirectTo: "http://localhost:3000/callback",
    });
    if (!result3.success || !result3.session)
      throw new Error("Failed to register test user 3: " + JSON.stringify(result3));
    const session = result3.session;

    testUsers.push(session.user.id);

    const res = await request(app)
      .delete("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .expect(400);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });

  it("should fail if a request body is provided", async () => {
    const identity4 = generateTestIdentity("me-api-del-4");

    const result4 = await authGateway.registerWithPassword({
      email: identity4.email,
      password: identity4.password,
      emailRedirectTo: "http://localhost:3000/callback",
    });
    if (!result4.success || !result4.session) throw new Error("Failed to register test user 4");
    const session = result4.session;

    testUsers.push(session.user.id);

    const res = await request(app)
      .delete("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("Idempotency-Key", "some-key")
      .send({ malicious: "payload" })
      .expect(422);

    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });
});
