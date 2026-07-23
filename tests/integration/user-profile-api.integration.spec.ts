import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";
import { createUserProfileRouter } from "../../src/features/users/user-profile.router.js";
import type { AccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";
import type { UserProfileRepository } from "../../src/persistence/users/user-profile.repository.js";
import { createUserProfileService } from "../../src/features/users/user-profile.service.js";
import type { UserProfile } from "../../src/features/users/user-profile.types.js";
import { HTTP_STATUS } from "../../src/constants/http.constants.js";

import { PersistenceError, PersistenceErrorCode } from "../../src/persistence/persistence-error.js";

describe("UserProfile API Integration", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  const validClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000) - 3600,
    sub: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    role: "authenticated",
    aal: "aal1",
    session_id: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  const validProfile: UserProfile = {
    id: validClaims.sub,
    email: "test@example.com",
    fullName: "Test User",
    college: null,
    branch: null,
    graduationYear: null,
    experienceLevel: null,
    preferredRoles: [],
    bio: null,
    avatarUrl: null,
    role: "student",
    accountStatus: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  let mockVerifier: jest.Mocked<AccessTokenVerifier>;
  let mockRepo: jest.Mocked<UserProfileRepository>;
  let app: any;

  beforeEach(() => {
    mockVerifier = { verify: jest.fn<any>() };
    mockRepo = {
      findById: jest.fn<any>(),
      updateOwnProfile: jest.fn<any>(),
      isActive: jest.fn<any>(),
    };

    const authMiddleware = createAuthenticationMiddleware({
      config,
      verifier: mockVerifier,
      now: () => Date.now(),
    });

    const service = createUserProfileService(mockRepo);
    const serviceFactory = () => service;
    const usersRouter = createUserProfileRouter({ config, serviceFactory, authMiddleware });

    const apiRouter = Router();
    apiRouter.use("/users", usersRouter);

    app = createApp({ config, apiRouter });
  });

  it("returns 200 and the mapped profile if active", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
    mockRepo.findById.mockResolvedValue(validProfile);

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(validProfile.id);
  });

  it("returns 403 if account is suspended", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
    mockRepo.findById.mockResolvedValue({ ...validProfile, accountStatus: "suspended" });

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(res.body.code).toBe("ACCOUNT_DISABLED");
  });

  it("returns 403 if account is pending deletion", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
    mockRepo.findById.mockResolvedValue({ ...validProfile, deletedAt: new Date() });

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(res.body.code).toBe("ACCOUNT_DELETED");
  });

  it("returns 404 if profile not found", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
    mockRepo.findById.mockRejectedValue(
      new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found"),
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(res.body.code).toBe("USER_PROFILE_NOT_FOUND");
  });
});
