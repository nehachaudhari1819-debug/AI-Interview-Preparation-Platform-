import { Router } from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { createCsrfOriginGuard } from "../../src/security/index.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("CSRF Request Origin", () => {
  const config = createTestApplicationConfig();
  const testRouter = Router();
  testRouter.post("/protected", createCsrfOriginGuard(config), (req, res) => {
    res.json({ ok: true });
  });

  const app = createApp({ config, apiRouter: testRouter });

  it("blocks cross-site fetch site on POST", async () => {
    const response = await request(app)
      .post("/api/v1/protected")
      .set("Origin", "http://localhost:5173")
      .set("Sec-Fetch-Site", "cross-site");

    const body = response.body as { code: string };
    expect(body.code).toBe("CSRF_ORIGIN_DENIED");
  });
});
