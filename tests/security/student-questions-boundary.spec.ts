import { describe, it, expect } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("Student Questions Security Boundary", () => {
  it("should prevent anonymous access to student questions", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const res = await request(app).get("/api/v1/questions");
    expect(res.status).toBe(401);
  });

  it("should prevent anonymous access to student question detail", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const res = await request(app).get("/api/v1/questions/00000000-0000-4000-8000-000000000000");
    expect(res.status).toBe(401);
  });

  it("should prevent anonymous access to student taxonomies", async () => {
    const config = createTestApplicationConfig();
    const app = createApp({ config });

    const res = await request(app).get("/api/v1/questions/skills");
    expect(res.status).toBe(401);
  });
});
// Force Jest cache invalidation
