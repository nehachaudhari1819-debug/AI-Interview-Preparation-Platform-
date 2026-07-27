import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Admin Authorization Boundary", () => {
  it("should reject requests without authentication", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const res = await request(app).post("/api/v1/admin/taxonomies/skills").send({ name: "Test" });
    expect(res.status).toBe(401);
  });
});
// Force Jest cache invalidation
