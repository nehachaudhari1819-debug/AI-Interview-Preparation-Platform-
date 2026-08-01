import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createTestApp } from "../setup/real-environment.js";

describe("Interviews API Security", () => {
  it("should deny unauthenticated POST /api/v1/interviews", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/v1/interviews").send({});
    // We expect a 401 Unauthorized since there is no token
    expect(res.status).toBe(401);
  });

  it("should deny unauthenticated GET /api/v1/interviews", async () => {
    const { app } = createTestApp();
    const res = await request(app).get("/api/v1/interviews");
    expect(res.status).toBe(401);
  });

  it("should deny unauthenticated POST /api/v1/interviews/:id/sessions", async () => {
    const { app } = createTestApp();
    const res = await request(app).post("/api/v1/interviews/123/sessions").send({});
    expect(res.status).toBe(401);
  });
});
