import supertest from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Rate Limit Proxy Spoofing", () => {
  it("cannot bypass TRUST_PROXY_HOPS=0 via forwarding headers", async () => {
    const config = createTestApplicationConfig({
      security: {
        trustProxyHops: 0, // strict 0 hops
        cors: { allowedOrigins: [], credentials: true, preflightMaxAgeSeconds: 600 },
        helmet: { enableHsts: false },
      },
      rateLimits: {
        ipv6Subnet: 56,
        globalApi: { enabled: true, windowMs: 90000, maxRequests: 1 },
        authCredentials: { enabled: false, windowMs: 900000, maxRequests: 5 },
        authSession: { enabled: false, windowMs: 900000, maxRequests: 10 },
      },
    });
    const app = createApp({ config });
    const request = supertest(app);

    // First request uses quota
    await request.get("/api/v1/auth/me").set("X-Forwarded-For", "192.168.1.100");

    // Second request with different spoofed IP should still be blocked (because proxy is untrusted, so IP is always localhost/test ip)
    const res = await request.get("/api/v1/auth/me").set("X-Forwarded-For", "192.168.1.101");
    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
  });
});
