import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";

describe("Public and Protected Route Boundary Security", () => {
  const config = createTestApplicationConfig();

  it("authentication middleware is not mounted globally by default", async () => {
    const apiRouter = Router();

    // Route 1 is public, it does not use the middleware
    apiRouter.get("/public", (req, res) => {
      res.json({ ok: true, state: req.context.authentication.state });
    });

    // Route 2 is protected
    const authMiddleware = createAuthenticationMiddleware({
      config,
      verifier: { verify: jest.fn<any>().mockResolvedValue({ success: false, reason: "invalid" }) },
    });
    apiRouter.get("/protected", authMiddleware, (req, res) => {
      res.json({ ok: true });
    });

    const app = createApp({ config, apiRouter });

    // The public route should be accessible without token and have anonymous state
    const publicResponse = await request(app).get("/api/v1/public");
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.body.state).toBe("anonymous");

    // The protected route should require authentication
    const protectedResponse = await request(app).get("/api/v1/protected");
    expect(protectedResponse.status).toBe(401);
  });
});
