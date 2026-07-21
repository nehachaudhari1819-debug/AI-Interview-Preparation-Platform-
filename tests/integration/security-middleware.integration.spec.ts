import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Security Middleware Integration", () => {
  it("processes a safe cross-origin request", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app)
      .options("/api/v1/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("blocks a forbidden cross-origin request", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app)
      .options("/api/v1/health")
      .set("Origin", "https://malicious.com");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CORS_ORIGIN_DENIED");
  });
});
