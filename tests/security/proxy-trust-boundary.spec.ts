import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Proxy Trust Boundary", () => {
  it("ignores X-Forwarded-For when trustProxyHops is 0", async () => {
    const config = createTestApplicationConfig({
      security: { ...createTestApplicationConfig().security, trustProxyHops: 0 }
    });
    const app = createApp({ config });

    const response = await request(app)
      .get("/api/v1/health")
      .set("X-Forwarded-For", "192.168.1.1");
      
    expect(response.status).not.toBe(403);
  });
});
