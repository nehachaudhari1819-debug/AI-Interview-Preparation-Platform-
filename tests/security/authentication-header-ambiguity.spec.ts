import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";
import type { AccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";

describe("Authentication Header Ambiguity Security", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };
  const verifier: AccessTokenVerifier = {
    verify: jest.fn<any>().mockResolvedValue({
      success: true,
      claims: {
        iss: "https://example.com/auth/v1",
        aud: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000) - 3600,
        sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
        role: "authenticated",
        aal: "aal1",
        session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
        is_anonymous: false,
      },
    }),
  };

  const app = createApp({
    config,
    apiRouter: Router().get(
      "/protected",
      createAuthenticationMiddleware({ config, verifier }),
      (req, res) => {
        res.json({ ok: true });
      },
    ),
  });

  it("rejects duplicate Authorization headers", async () => {
    // supertest .set() with array sends multiple headers
    const response = await request(app)
      .get("/api/v1/protected")
      .set("Authorization", "Bearer token1, Bearer token2");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_AUTHORIZATION_HEADER");
  });

  it("rejects comma separated Authorization header", async () => {
    const response = await request(app)
      .get("/api/v1/protected")
      .set("Authorization", "Bearer token1, Bearer token2");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_AUTHORIZATION_HEADER");
  });
});
