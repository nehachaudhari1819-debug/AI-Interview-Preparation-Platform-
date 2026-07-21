import { Router } from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createCsrfOriginGuard } from "../../src/security/index.js";
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

    const body = response.body as { code: string };
    expect(body.code).toBe("CORS_ORIGIN_DENIED");
  });

  it("allows normal JSON POST without Origin on unprotected routes", async () => {
    const testRouter = Router();
    testRouter.post("/unprotected", (req, res) => {
      res.json({ ok: true });
    });

    const config = createTestApplicationConfig();
    const app = createApp({ config, apiRouter: testRouter });

    const response = await request(app).post("/api/v1/unprotected").send({ data: "test" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("blocks CSRF-protected POST without Origin", async () => {
    const config = createTestApplicationConfig();
    const testRouter = Router();
    testRouter.post("/protected", createCsrfOriginGuard(config), (req, res) => {
      res.json({ ok: true });
    });

    const app = createApp({ config, apiRouter: testRouter });

    const response = await request(app).post("/api/v1/protected").send({ data: "test" });

    expect(response.status).toBe(403);
    const body = response.body as { code: string };
    expect(body.code).toBe("CSRF_ORIGIN_DENIED");
  });
});
