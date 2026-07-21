import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Security Header Policy", () => {
  it("includes expected helmet headers", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const response = await request(app).get("/api/v1/health");

    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["content-security-policy"]).toBeDefined();
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});
