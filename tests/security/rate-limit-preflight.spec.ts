import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Rate Limit Preflight", () => {
  it("OPTIONS does not consume quota", async () => {
    const config = createTestApplicationConfig({
      rateLimits: {
        ipv6Subnet: 56,
        globalApi: { enabled: true, windowMs: 90000, maxRequests: 1 },
        authCredentials: { enabled: true, windowMs: 90000, maxRequests: 1 },
        authSession: { enabled: true, windowMs: 90000, maxRequests: 1 },
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // Make an OPTIONS request (should not consume quota)
    await request.options("/api/v1/auth/me");
    await request.options("/api/v1/auth/me");

    // Make a GET request (should pass since quota is 1 and OPTIONS didn't consume it)
    const res = await request.get("/api/v1/auth/me");
    expect(res.status).not.toBe(429);
  });
});
