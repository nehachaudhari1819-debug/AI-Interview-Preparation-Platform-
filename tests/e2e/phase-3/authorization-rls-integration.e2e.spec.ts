import request from "supertest";
import { createClient } from "@supabase/supabase-js";
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

describe("E2E: Authorization RLS Integration (Phase 3.6)", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];
  const authGateway = createSupabaseAuthGateway({ config: appConfig });

  let userA: any;
  let userB: any;

  beforeAll(async () => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;

    // 1 & 2. Provision active User A and User B
    const identityA = generateTestIdentity("user-a-rls");
    const aRes = await testAdminClient.auth.admin.createUser({
      email: identityA.email,
      password: identityA.password,
      email_confirm: true,
    });
    testUsers.push(aRes.data.user!.id);
    const loginA = await authGateway.loginWithPassword({
      email: identityA.email,
      password: identityA.password,
    });
    if (!loginA.success) throw new Error("Login failed");
    userA = { ...aRes.data.user, token: loginA.session.accessToken };

    const identityB = generateTestIdentity("user-b-rls");
    const bRes = await testAdminClient.auth.admin.createUser({
      email: identityB.email,
      password: identityB.password,
      email_confirm: true,
    });
    testUsers.push(bRes.data.user!.id);
    const loginB = await authGateway.loginWithPassword({
      email: identityB.email,
      password: identityB.password,
    });
    if (!loginB.success) throw new Error("Login failed");
    userB = { ...bRes.data.user, token: loginB.session.accessToken };
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  describe("Active Users", () => {
    it("4. User A GET profile returns 200", async () => {
      const res = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`)
        .expect(HTTP_STATUS.OK);
      expect(res.body.data.user.id).toBe(userA.id);
    });

    it("5. User A PATCH own profile returns 200", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ fullName: "Updated by A" })
        .expect(HTTP_STATUS.OK);
      expect(res.body.data.user.fullName).toBe("Updated by A");
    });
  });

  describe("Direct Data API Isolation", () => {
    let clientA: any;

    beforeAll(() => {
      if (!appConfig.supabase.configured) throw new Error("Supabase is not configured");
      clientA = createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
        global: { headers: { Authorization: `Bearer ${userA.token}` } },
      });
    });

    it("6. User A direct Supabase SELECT returns only User A", async () => {
      const { data } = await clientA.from("users").select("*");
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(userA.id);
    });

    it("7. User A cannot SELECT User B", async () => {
      const { data } = await clientA.from("users").select("*").eq("id", userB.id);
      expect(data).toHaveLength(0);
    });

    it("8. User A cannot UPDATE User B", async () => {
      const { data, error } = await clientA
        .from("users")
        .update({ full_name: "Hacked" })
        .eq("id", userB.id)
        .select();
      // Should return empty array, no rows updated due to RLS
      expect(data).toHaveLength(0);
    });

    it("9,10,11,12. User A cannot update protected columns", async () => {
      // Trying to update email, role, account_status, deleted_at
      const { error } = await clientA
        .from("users")
        .update({
          email: "hacked@example.com",
          role: "admin",
          account_status: "admin",
          deleted_at: new Date().toISOString(),
        })
        .eq("id", userA.id);

      // Postgrest should fail if the columns are restricted by column-level grants
      expect(error).not.toBeNull();
    });

    it("13, 14. User A cannot insert or delete public.users", async () => {
      const insertRes = await clientA.from("users").insert({ id: userB.id });
      expect(insertRes.error).not.toBeNull();

      const deleteRes = await clientA.from("users").delete().eq("id", userA.id);
      expect(deleteRes.error).not.toBeNull();
    });

    it("15, 16. User A cannot read system tables", async () => {
      const auditRes = await clientA.from("audit_logs").select("*");
      expect(auditRes.error).not.toBeNull();

      const idempRes = await clientA.from("idempotency_records").select("*");
      expect(idempRes.error).not.toBeNull();
    });

    it("17. User A cannot call lifecycle RPCs", async () => {
      const rpcRes = await clientA.rpc("prepare_soft_delete_account", {
        p_user_id: userA.id,
        p_idempotency_key: "test",
        p_request_id: "test",
        p_request_hash: "test",
        p_operation: "test",
      });
      expect(rpcRes.error).not.toBeNull();
    });

    it("18, 19. User A account-state resolver returns active with no PII", async () => {
      const { data, error } = await clientA.rpc("get_current_account_access_state");
      expect(error).toBeNull();
      expect(data).toBe("active");
    });
  });

  describe("Suspended and Deleted Behavior", () => {
    it("21. Suspend User A", async () => {
      await testAdminClient
        .from("users")
        .update({ account_status: "suspended" })
        .eq("id", userA.id);
    });

    it("22, 23. GET and PATCH return 403 ACCOUNT_DISABLED", async () => {
      const resGet = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`);
      expect(resGet.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(resGet.body.code).toBe("ACCOUNT_DISABLED");

      const resPatch = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ fullName: "Fail" });
      expect(resPatch.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(resPatch.body.code).toBe("ACCOUNT_DISABLED");
    });

    it("26. Set User A to deletion_pending", async () => {
      await testAdminClient
        .from("users")
        .update({ account_status: "deletion_pending" })
        .eq("id", userA.id);
    });

    it("27, 28. GET and PATCH return 403 ACCOUNT_DELETED", async () => {
      const resGet = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`);
      expect(resGet.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(resGet.body.code).toBe("ACCOUNT_DELETED");

      const resPatch = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${userA.token}`)
        .send({ fullName: "Fail" });
      expect(resPatch.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(resPatch.body.code).toBe("ACCOUNT_DELETED");
    });

    it("35. User B remains active and unaffected", async () => {
      const resGet = await request(app)
        .get("/api/v1/users/me")
        .set("Authorization", `Bearer ${userB.token}`);
      expect(resGet.status).toBe(HTTP_STATUS.OK);
      expect(resGet.body.data.user.id).toBe(userB.id);
    });
  });
});
