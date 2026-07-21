import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Rate Limit Envelope", () => {
  it("returns properly formatted 429 error", async () => {
    const config = createTestApplicationConfig({
      security: {
        ...createTestApplicationConfig().security,
        rateLimit: { enabled: true, windowMs: 1000, maxRequests: 1 }
      }
    });
    const app = createApp({ config });

    await request(app).get("/api/v1/health");
    const response = await request(app).get("/api/v1/health");
    
    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});
