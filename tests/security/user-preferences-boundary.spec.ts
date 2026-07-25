import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";
import { createUserPreferencesRouter } from "../../src/features/users/user-preferences.router.js";
import type { AccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";
import { HTTP_STATUS } from "../../src/constants/http.constants.js";

// We want to ensure that there are no URL params that allow cross-user access.
// Since the router ONLY mounts on / (which is mapped to /api/v1/users/me/preferences),
// all access is implicitly bounded to req.user.id.

describe("UserPreferences Security Boundary", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  let mockVerifier: jest.Mocked<AccessTokenVerifier>;
  let app: any;

  beforeEach(() => {
    mockVerifier = { verify: jest.fn<any>() };

    const authMiddleware = createAuthenticationMiddleware({
      config,
      verifier: mockVerifier,
      now: () => Date.now(),
    });

    const activeAccountMiddleware = (req: any, res: any, next: any) => next();

    const preferencesRouter = createUserPreferencesRouter({
      config,
      authMiddleware,
      activeAccountMiddleware,
    });

    const apiRouter = Router();
    apiRouter.use("/users/me/preferences", preferencesRouter);

    app = createApp({ config, apiRouter });
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app).get("/api/v1/users/me/preferences");
    expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
  });

  it("does not allow specifying an ID in the URL for GET", async () => {
    mockVerifier.verify.mockResolvedValue({
      success: true,
      claims: { sub: "auth-id", role: "authenticated" },
    });

    const res = await request(app)
      .get("/api/v1/users/other-id/preferences")
      .set("Authorization", "Bearer valid-token");

    // The route /users/other-id/preferences does not exist on this router
    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
  });

  it("does not allow specifying an ID in the URL for PATCH", async () => {
    mockVerifier.verify.mockResolvedValue({
      success: true,
      claims: { sub: "auth-id", role: "authenticated" },
    });

    const res = await request(app)
      .patch("/api/v1/users/other-id/preferences")
      .set("Authorization", "Bearer valid-token")
      .send({ locale: "fr" });

    // The route /users/other-id/preferences does not exist on this router
    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
  });
});
