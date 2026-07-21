import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("CORS Origin Isolation", () => {
  const config = createTestApplicationConfig();
  const app = createApp({ config });

  it("allows configured origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173");
    
    expect(response.status).not.toBe(403);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("denies unconfigured origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://untrusted.com");
    
    expect(response.status).toBe(403);
  });
});
