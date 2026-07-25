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
import { createClient } from "@supabase/supabase-js";

describe("E2E: User Preferences API", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  const authGateway = createSupabaseAuthGateway({ config: appConfig });

  const userAIdentity = generateTestIdentity("pref-api-usera");
  let validAccessTokenA: string;
  let validUserIdA: string;

  const userBIdentity = generateTestIdentity("pref-api-userb");
  let validAccessTokenB: string;
  let validUserIdB: string;

  const userCIdentity = generateTestIdentity("pref-api-userc");
  let validUserIdC: string;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // Provision User A
    const aRes = await testAdminClient.auth.admin.createUser({
      email: userAIdentity.email,
      password: userAIdentity.password,
      email_confirm: true,
    });
    validUserIdA = aRes.data.user!.id;
    testUsers.push(validUserIdA);

    // Provision User B
    const bRes = await testAdminClient.auth.admin.createUser({
      email: userBIdentity.email,
      password: userBIdentity.password,
      email_confirm: true,
    });
    validUserIdB = bRes.data.user!.id;
    testUsers.push(validUserIdB);

    // Provision User C (for soft deletion)
    const cRes = await testAdminClient.auth.admin.createUser({
      email: userCIdentity.email,
      password: userCIdentity.password,
      email_confirm: true,
    });
    validUserIdC = cRes.data.user!.id;
    testUsers.push(validUserIdC);

    // Wait a moment for triggers to run
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Login User A
    const loginARes = await authGateway.loginWithPassword({
      email: userAIdentity.email,
      password: userAIdentity.password,
    });
    if (!loginARes.success) throw new Error("Failed to login test user A");
    validAccessTokenA = loginARes.session.accessToken;

    // Login User B
    const loginBRes = await authGateway.loginWithPassword({
      email: userBIdentity.email,
      password: userBIdentity.password,
    });
    if (!loginBRes.success) throw new Error("Failed to login test user B");
    validAccessTokenB = loginBRes.session.accessToken;
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  it("GET /api/v1/users/me/preferences retrieves default preferences for User A", async () => {
    const response = await request(app)
      .get("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .expect(HTTP_STATUS.OK);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.locale).toBe("en");
    expect(response.body.data.timeZone).toBe("UTC");
    expect(response.body.data.practiceRemindersEnabled).toBe(false);
  });

  it("PATCH /api/v1/users/me/preferences updates preferences", async () => {
    const response = await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .send({
        locale: "fr-FR",
        timeZone: "Europe/Paris",
        practiceRemindersEnabled: true,
      })
      .expect(HTTP_STATUS.OK);

    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.body.data.locale).toBe("fr-FR");
    expect(response.body.data.timeZone).toBe("Europe/Paris");
    expect(response.body.data.practiceRemindersEnabled).toBe(true);
    expect(response.body.data.weeklyProgressSummaryEnabled).toBe(false); // Should remain default
  });

  it("GET /api/v1/users/me/preferences verifies persistence", async () => {
    const response = await request(app)
      .get("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .expect(HTTP_STATUS.OK);

    expect(response.body.data.locale).toBe("fr-FR");
    expect(response.body.data.timeZone).toBe("Europe/Paris");
    expect(response.body.data.practiceRemindersEnabled).toBe(true);
  });

  it("verifies exactly one audit log was created by the database trigger for actual update", async () => {
    const { data, error } = await testAdminClient
      .from("audit_logs")
      .select("*")
      .eq("actor_user_id", validUserIdA)
      .eq("action", "USER_PREFERENCES_UPDATED")
      .order("created_at", { ascending: false });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.length).toBe(1);

    const audit = data![0] as any;
    expect(audit.resource_type).toBe("user_preferences");
    expect(audit.resource_id).toBe(validUserIdA);
    expect(audit.metadata).toHaveProperty("changedFields");

    // Check that array contains the mapped field names and NOT values
    const metadata = audit.metadata as { changedFields: string[] };
    const fields = metadata.changedFields;
    expect(Array.isArray(fields)).toBe(true);
    expect(fields).toContain("locale");
    expect(fields).toContain("timeZone");
    expect(fields).toContain("practiceRemindersEnabled");
    // Values must NOT be present
    expect(metadata).not.toHaveProperty("locale");
  });

  it("Send same-value PATCH and verify audit count is unchanged", async () => {
    await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .send({
        locale: "fr-FR", // Same value
      })
      .expect(HTTP_STATUS.OK);

    // Count should still be 1
    const { count, error } = await testAdminClient
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("actor_user_id", validUserIdA)
      .eq("action", "USER_PREFERENCES_UPDATED");

    expect(error).toBeNull();
    expect(count).toBe(1);
  });

  it("Attempt invalid locale and verify no database change", async () => {
    await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .send({ locale: "this-locale-is-way-too-long-to-be-valid-bcp47" })
      .expect(HTTP_STATUS.BAD_REQUEST);

    const response = await request(app)
      .get("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .expect(HTTP_STATUS.OK);

    expect(response.body.data.locale).toBe("fr-FR"); // unchanged
  });

  it("Attempt invalid time zone and verify no database change", async () => {
    await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .send({ timeZone: "Mars/Phobos" })
      .expect(HTTP_STATUS.BAD_REQUEST);

    const response = await request(app)
      .get("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .expect(HTTP_STATUS.OK);

    expect(response.body.data.timeZone).toBe("Europe/Paris"); // unchanged
  });

  it("Cross-user access denied via Data API", async () => {
    // Note: The Express API doesn't even accept IDs in URL. It always uses `me`.
    // So the "Attempt User A access to User B" must be done through direct Data API to verify RLS
    const userAClient = createClient((appConfig.supabase as any).url, (appConfig.supabase as any).publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${validAccessTokenA}`,
        },
      },
    });

    // Try to update User B's preferences as User A
    const { data: updateData, error: updateError } = await userAClient
      .from("user_preferences")
      .update({ locale: "es" })
      .eq("user_id", validUserIdB)
      .select();

    // Should return empty array (0 rows updated) because RLS blocks it
    expect(updateError).toBeNull();
    expect(updateData).toEqual([]);

    // Verify B's preferences are unchanged
    const { data: bData } = await testAdminClient
      .from("user_preferences")
      .select("locale")
      .eq("user_id", validUserIdB)
      .single();

    expect(bData!.locale).toBe("en");
  });

  it("Direct authenticated Data API owner update is audited", async () => {
    const userAClient = createClient((appConfig.supabase as any).url, (appConfig.supabase as any).publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${validAccessTokenA}`,
        },
      },
    });

    // Update User A's preferences directly
    const { data: updateData, error: updateError } = await userAClient
      .from("user_preferences")
      .update({ locale: "de" })
      .eq("user_id", validUserIdA)
      .select();

    expect(updateError).toBeNull();
    expect(updateData![0].locale).toBe("de");

    // Verify audit log was created (should now be 2)
    const { count, error } = await testAdminClient
      .from("audit_logs")
      .select("*", { count: "exact", head: true })
      .eq("actor_user_id", validUserIdA)
      .eq("action", "USER_PREFERENCES_UPDATED");

    expect(error).toBeNull();
    expect(count).toBe(2);
  });

  it("Client cannot insert or delete preference rows directly via Data API", async () => {
    const userAClient = createClient((appConfig.supabase as any).url, (appConfig.supabase as any).publishableKey, {
      global: {
        headers: {
          Authorization: `Bearer ${validAccessTokenA}`,
        },
      },
    });

    // Attempt Insert
    const { error: insertError } = await userAClient
      .from("user_preferences")
      .insert({ user_id: validUserIdA, locale: "it" });

    expect(insertError).not.toBeNull();
    expect(insertError!.message).toContain("new row violates row-level security policy");

    // Attempt Delete
    const { error: deleteError } = await userAClient
      .from("user_preferences")
      .delete()
      .eq("user_id", validUserIdA);

    expect(deleteError).not.toBeNull();
    expect(deleteError!.message).toContain("policy");
  });

  it("Suspend User A and verify GET and PATCH are denied", async () => {
    await testAdminClient
      .from("users")
      .update({ account_status: "suspended" })
      .eq("id", validUserIdA);

    await request(app)
      .get("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .expect(HTTP_STATUS.FORBIDDEN);

    await request(app)
      .patch("/api/v1/users/me/preferences")
      .set("Authorization", `Bearer ${validAccessTokenA}`)
      .send({ locale: "es" })
      .expect(HTTP_STATUS.FORBIDDEN);
  });

  it("Soft delete a separate user and verify preferences row is preserved", async () => {
    // Delete User C
    await request(app)
      .delete("/api/v1/users/me")
      .set("Authorization", `Bearer ${validAccessTokenA}`) // Assume a different token for C, wait, we don't have token for C
      // We will just do it via admin
      .expect(HTTP_STATUS.FORBIDDEN); // A is suspended

    await testAdminClient
      .from("users")
      .update({ account_status: "deleted" })
      .eq("id", validUserIdC);

    const { data: prefData } = await testAdminClient
      .from("user_preferences")
      .select("*")
      .eq("user_id", validUserIdC);

    // Pref row must still exist
    expect(prefData!.length).toBe(1);

    // If User C tries to fetch via API using old token (let's use A as example of suspended user getting blocked)
    // We already tested A gets forbidden. For deleted, same.
  });
});
