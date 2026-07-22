import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Rate Limit Policy Layering", () => {
  it("separate limiter policies do not share stores", async () => {
    const config = createTestApplicationConfig({
      rateLimits: {
        ipv6Subnet: 56,
        globalApi: { enabled: true, windowMs: 90000, maxRequests: 5 },
        authCredentials: { enabled: true, windowMs: 90000, maxRequests: 1 },
        authSession: { enabled: true, windowMs: 90000, maxRequests: 10 },
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // Exhaust auth credentials limit (1)
    await request.post("/api/v1/auth/login").send({ email: "a@a.com", password: "123" });
    const resAuth = await request
      .post("/api/v1/auth/login")
      .send({ email: "a@a.com", password: "123" });
    expect(resAuth.status).toBe(429);

    // Global limit should not be exhausted (limit is 5)
    const resGlobal = await request.get("/api/v1/auth/me");
    expect(resGlobal.status).not.toBe(429);
  });
});
