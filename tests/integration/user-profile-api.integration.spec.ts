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
    const serviceMiddleware = (req: any, res: any, next: any) => {
      res.locals.userProfileService = service;
      next();
    };
    const activeAccountMiddleware = async (req: any, res: any, next: any) => {
      try {
        // Mimic gateway by querying mockRepo
        let profile;
        try {
          profile = await mockRepo.findById(req.context.authentication.principal.id);
        } catch (err: any) {
          throw Object.assign(new Error("Not found"), {
            name: "UserProfileNotFoundError",
            isAppError: true,
            statusCode: 404,
            code: "USER_PROFILE_NOT_FOUND",
          });
        }

        if (profile.deletedAt) {
          throw Object.assign(new Error("Deleted"), {
            name: "AccountDeletedError",
            isAppError: true,
            statusCode: 403,
            code: "ACCOUNT_DELETED",
          });
        }
        if (profile.accountStatus === "suspended") {
          throw Object.assign(new Error("Disabled"), {
            name: "AccountDisabledError",
            isAppError: true,
            statusCode: 403,
            code: "ACCOUNT_DISABLED",
          });
        }
        if (profile.accountStatus !== "active") {
          throw Object.assign(new Error("Not found"), {
            name: "UserProfileNotFoundError",
            isAppError: true,
            statusCode: 404,
            code: "USER_PROFILE_NOT_FOUND",
          });
        }
        next();
      } catch (err) {
        next(err);
      }
    };

    const usersRouter = createUserProfileRouter({
      config,
      serviceMiddleware,
      authMiddleware,
      activeAccountMiddleware,
    });

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

  describe("PATCH /api/v1/users/me", () => {
    it("returns 200 and the updated profile successfully", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockRepo.updateOwnProfile.mockResolvedValue({ ...validProfile, fullName: "Updated Name" });

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.fullName).toBe("Updated Name");
      expect(res.header["cache-control"]).toContain("no-store");
      expect(mockRepo.updateOwnProfile).toHaveBeenCalledWith(validClaims.sub, {
        fullName: "Updated Name",
      });
    });

    it("returns 422 for empty update object", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(mockRepo.updateOwnProfile).not.toHaveBeenCalled();
    });

    it("returns 422 for unknown fields", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({ unknownField: "test" });

      expect(res.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 422 for protected fields like email or id", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });

      const resId = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({ id: "123" });
      expect(resId.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);

      const resEmail = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({ email: "test@example.com" });
      expect(resEmail.status).toBe(HTTP_STATUS.UNPROCESSABLE_ENTITY);
    });

    it("returns 404 if profile missing or hidden by RLS", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockRepo.updateOwnProfile.mockRejectedValue(
        new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found"),
      );

      const res = await request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", "Bearer valid-token")
        .send({ fullName: "Updated Name" });

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.code).toBe("USER_PROFILE_NOT_FOUND");
    });
  });
});
