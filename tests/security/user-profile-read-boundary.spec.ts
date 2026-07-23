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

describe("Security: User Profile Read Boundary", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  const activeClaims = {
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

  const suspendedClaims = {
    ...activeClaims,
    sub: "a390f1ee-6c54-4b01-90e6-d701748f0853",
    session_id: "b440f1ee-6c54-4b01-90e6-d701748f0854",
  };

  const activeProfile: UserProfile = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    email: "active@example.com",
    fullName: "Active User",
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

  const suspendedProfile: UserProfile = {
    ...activeProfile,
    id: "a390f1ee-6c54-4b01-90e6-d701748f0853",
    email: "suspended@example.com",
    fullName: "Suspended User",
    accountStatus: "suspended",
  };

  const deletedProfile: UserProfile = {
    ...activeProfile,
    id: "a390f1ee-6c54-4b01-90e6-d701748f0853",
    email: "deleted@example.com",
    fullName: "Deleted User",
    deletedAt: new Date(),
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
    const serviceMiddleware = (req: any, res: any, next: any) => {
      res.locals.userProfileService = service;
      next();
    };
    const usersRouter = createUserProfileRouter({ config, serviceMiddleware, authMiddleware });

    const apiRouter = Router();
    apiRouter.use("/users", usersRouter);

    app = createApp({ config, apiRouter });
  });

  it("prevents reading profile of a suspended user", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: suspendedClaims });
    mockRepo.findById.mockResolvedValue(suspendedProfile);

    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer token");

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(res.body.code).toBe("ACCOUNT_DISABLED");
  });

  it("prevents reading profile of a user pending deletion", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: suspendedClaims });
    mockRepo.findById.mockResolvedValue(deletedProfile);

    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer token");

    expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
    expect(res.body.code).toBe("ACCOUNT_DELETED");
  });

  it("strips internal domain fields from the response payload", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: activeClaims });
    mockRepo.findById.mockResolvedValue(activeProfile);

    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer token");

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.body.data.user.id).toBe(activeProfile.id);
    expect(res.body.data.user.deletedAt).toBeUndefined();
    expect(Object.keys(res.body.data.user)).not.toContain("deletedAt");
  });

  it("applies no-store cache headers to prevent sensitive data caching", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: activeClaims });
    mockRepo.findById.mockResolvedValue(activeProfile);

    const res = await request(app).get("/api/v1/users/me").set("Authorization", "Bearer token");

    expect(res.status).toBe(HTTP_STATUS.OK);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
