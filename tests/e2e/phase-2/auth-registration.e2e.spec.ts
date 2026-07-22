import request from "supertest";
import {
  appConfig,
  generateTestIdentity,
  cleanupTestUser,
  createTestApp,
} from "../../setup/real-environment.js";
import { HTTP_STATUS } from "../../../src/constants/http.constants.js";
import type { Express } from "express";
import type { Server } from "node:http";

describe("Real Environment: POST /auth/register", () => {
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
    // Cleanup generated identities
    for (const userId of testUsers) {
      await cleanupTestUser(userId);
    }
  });

  it("registers a valid user and returns the approved 202 Accepted status without tokens", async () => {
    const identity = generateTestIdentity("reg-valid");

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: identity.email,
        password: identity.password,
      })
      .expect("Content-Type", /json/)
      .expect(HTTP_STATUS.ACCEPTED);

    const body = response.body;

    // Request ID presence
    expect(body.meta.requestId).toBeDefined();

    // Data envelope conforms to contract
    expect(body.data).toBeDefined();
    expect(body.data.status).toBe("authenticated");

    if (body.data.status === "authenticated" && body.data.user) {
      testUsers.push(body.data.user.id);
    }

    // Ensure no token is passed back in the payload body (unless status === authenticated and it was explicitly asked for, but we don't expect it here based on P2.12 reqs)
    expect(body.data.accessToken).toBeUndefined();
  });

  it("enforces strong passwords using the standard validation envelope", async () => {
    const identity = generateTestIdentity("reg-weak");

    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: identity.email,
        password: "123", // Weak password
      })
      .expect("Content-Type", /json/)
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    const body = response.body;
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("handles malformed input with the standard validation envelope", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: "not-an-email",
        password: "",
      })
      .expect("Content-Type", /json/)
      .expect(HTTP_STATUS.UNPROCESSABLE_ENTITY);

    const body = response.body;
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("does not leak provider internals on duplicate registration", async () => {
    const identity = generateTestIdentity("reg-dup");

    // First registration
    const firstRes = await request(app).post("/api/v1/auth/register").send({
      email: identity.email,
      password: identity.password,
    });

    if (firstRes.body.data?.user?.id) {
      testUsers.push(firstRes.body.data.user.id);
    }

    // Second registration (duplicate)
    const secondRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: identity.email,
        password: identity.password,
      })
      .expect("Content-Type", /json/);

    // Depending on Supabase settings, duplicate might return 202 identical to success, or a specific error.
    // The requirement is that it "does not leak whether an account exists" (if configured so) or at least does not leak internals.
    expect(secondRes.body.code ?? "").not.toContain("23505"); // Postgres unique violation shouldn't bleed through
    expect(secondRes.body.message ?? "").not.toContain("database");
  });
});
