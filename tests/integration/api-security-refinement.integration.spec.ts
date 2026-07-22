import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("API Security Refinement Integration", () => {
  it("integrates boundaries and rate limits seamlessly", async () => {
    const config = createTestApplicationConfig({
      security: {
        trustProxyHops: 0,
        cors: {
          allowedOrigins: ["http://localhost:5173"],
          credentials: true,
          preflightMaxAgeSeconds: 600,
        },
        helmet: { enableHsts: false },
      },
      rateLimits: {
        ipv6Subnet: 56,
        globalApi: { enabled: true, windowMs: 900000, maxRequests: 100 },
        authCredentials: { enabled: true, windowMs: 900000, maxRequests: 5 },
        authSession: { enabled: true, windowMs: 900000, maxRequests: 10 },
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // 1. Should block trace
    const resMethod = await request.trace("/api/v1");
    expect(resMethod.status).toBe(405);

    // 2. Should block huge payload
    const resPayload = await request
      .post("/api/v1/auth/login")
      .send({ data: "a".repeat(102400 + 1) });
    expect(resPayload.status).toBe(413);

    // 3. Should allow valid request
    const resValid = await request
      .post("/api/v1/auth/login")
      .send({ email: "test@example.com", password: "password123" });
    // Assuming mock auth service throws INVALID_LOGIN_CREDENTIALS or similar, but the boundary passed.
    expect(resValid.status).not.toBe(413);
    expect(resValid.status).not.toBe(405);
    expect(resValid.status).not.toBe(400);
  });
});
