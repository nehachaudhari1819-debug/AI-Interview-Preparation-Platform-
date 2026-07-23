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

describe("Real Environment: Profile Provisioning", () => {
  let app: Express;
  let server: Server;
  const testUsers: string[] = [];

  beforeAll(() => {
    const testBoot = createTestApp();
    app = testBoot.app;
    server = testBoot.server;
  });

  afterAll(async () => {
    server.close();
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  it("provisions a public profile automatically upon successful registration", async () => {
    const identity = generateTestIdentity("prov-valid");

    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: identity.email,
        password: identity.password,
      })
      .expect(HTTP_STATUS.ACCEPTED);

    const body = registerRes.body;

    // Some implementations return the ID, some do not if email confirmation is required.
    // If not returned, we must search for the user via admin API to get the ID for cleanup and validation.
    let userId = body.data?.user?.id;

    if (!userId) {
      // Fetch from auth.users using admin client
      const {
        data: { users },
        error,
      } = await testAdminClient.auth.admin.listUsers();
      if (!error && users) {
        const createdUser = users.find((u) => u.email === identity.email);
        if (createdUser) userId = createdUser.id;
      }
    }

    expect(userId).toBeDefined();
    testUsers.push(userId);

    // Verify public profile exists with correct defaults
    const { data: profile, error } = await testAdminClient
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    expect(error).toBeNull();
    expect(profile).toBeDefined();
    expect(profile!.id).toBe(userId);
    expect(profile!.email).toBe(identity.email);
    expect(profile!.role).toBe("student"); // Safe default
    expect(profile!.account_status).toBe("active"); // Safe default
  });

  it("safely rejects privilege escalation metadata during registration with 422", async () => {
    const identity = generateTestIdentity("prov-escalate");

    const registerRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: identity.email,
        password: identity.password,
        // Attempting to escalate privileges through raw user metadata
        metadata: {
          role: "admin",
          account_status: "suspended",
          graduation_year: 2025,
        },
      })
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    expect(registerRes.body.code).toBe("VALIDATION_ERROR");
  });
});
