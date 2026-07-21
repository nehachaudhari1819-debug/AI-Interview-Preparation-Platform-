import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";
import { requireAuthenticatedPrincipal } from "../../src/auth/require-authenticated-principal.js";
import type { AccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";

describe("Authentication Middleware Integration", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };
  const now = () => 1700000000000;
  const currentTimeSecs = 1700000000;

  const validClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: currentTimeSecs + 3600,
    iat: currentTimeSecs - 3600,
    sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    role: "authenticated",
    aal: "aal1",
    session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  const setupApp = (verifierResult: any) => {
    const verifier: AccessTokenVerifier = {
      verify: jest.fn<any>().mockResolvedValue(verifierResult),
    };

    const authMiddleware = createAuthenticationMiddleware({ config, verifier, now });
    const apiRouter = Router();

    apiRouter.get("/public-probe", (req, res) => {
      res.json({ state: req.context.authentication.state });
    });

    apiRouter.get("/protected-probe", authMiddleware, (req, res) => {
      res.json({ state: req.context.authentication.state });
    });

    apiRouter.get("/principal-probe", authMiddleware, (req, res) => {
      const principal = requireAuthenticatedPrincipal(req);
      res.json({ principal });
    });

    return createApp({ config, apiRouter });
  };

  it("public probe works without authorization", async () => {
    const app = setupApp({ success: false, reason: "invalid" });
    const response = await request(app).get("/api/v1/public-probe");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ state: "anonymous" });
  });

  it("protected probe without token returns 401 AUTHENTICATION_REQUIRED", async () => {
    const app = setupApp({ success: false, reason: "invalid" });
    const response = await request(app).get("/api/v1/protected-probe");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTHENTICATION_REQUIRED");
    expect(response.headers["www-authenticate"]).toBe("Bearer");
    expect(response.body.meta.requestId).toBeDefined();
  });

  it("protected probe with malformed header returns 401 INVALID_AUTHORIZATION_HEADER", async () => {
    const app = setupApp({ success: false, reason: "invalid" });
    const response = await request(app)
      .get("/api/v1/protected-probe")
      .set("Authorization", "Basic credentials");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_AUTHORIZATION_HEADER");
    expect(response.headers["www-authenticate"]).toBe("Bearer");
  });

  it("protected probe with invalid token returns 401 INVALID_ACCESS_TOKEN", async () => {
    const app = setupApp({ success: false, reason: "invalid" });
    const response = await request(app)
      .get("/api/v1/protected-probe")
      .set("Authorization", "Bearer invalid-token");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_ACCESS_TOKEN");
  });

  it("protected probe with expired token returns 401 ACCESS_TOKEN_EXPIRED", async () => {
    const app = setupApp({ success: false, reason: "expired" });
    const response = await request(app)
      .get("/api/v1/protected-probe")
      .set("Authorization", "Bearer expired-token");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("ACCESS_TOKEN_EXPIRED");
  });

  it("protected probe with valid token returns safe normalized principal", async () => {
    const app = setupApp({ success: true, claims: validClaims });
    const response = await request(app)
      .get("/api/v1/principal-probe")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(200);
    expect(response.body.principal.userId).toBe(validClaims.sub);
    expect(response.body.principal.applicationRole).toBeNull();
    // Verify token is not in response
    expect(JSON.stringify(response.body)).not.toContain("valid-token");
  });
});
