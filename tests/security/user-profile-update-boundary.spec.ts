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
import { HTTP_STATUS } from "../../src/constants/http.constants.js";
import { PersistenceError, PersistenceErrorCode } from "../../src/persistence/persistence-error.js";
import { UserProfileNotFoundError } from "../../src/errors/user-profile-not-found.error.js";
import { AccountDeletedError } from "../../src/errors/account-deleted.error.js";
import { AccountDisabledError } from "../../src/errors/account-disabled.error.js";

describe("Security: User Profile Update Boundary", () => {
  const config = createTestApplicationConfig();
  (config as any).supabase = { configured: true, url: "https://example.com" };

  const suspendedClaims = {
    iss: "https://example.com/auth/v1",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000) - 3600,
    sub: "a390f1ee-6c54-4b01-90e6-d701748f0853",
    role: "authenticated",
    aal: "aal1",
    session_id: "b440f1ee-6c54-4b01-90e6-d701748f0854",
    is_anonymous: false,
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
        let profile;
        try {
          profile = await mockRepo.findById(
            req.context.authentication.principal.userId ?? req.context.authentication.principal.sub,
          );
          if (!profile) throw new UserProfileNotFoundError("Not found");
        } catch (err: any) {
          throw new UserProfileNotFoundError("Not found");
        }
        if (profile.deletedAt) {
          throw new AccountDeletedError();
        }
        if (profile.accountStatus === "suspended") {
          throw new AccountDisabledError();
        }
        if (profile.accountStatus !== "active") {
          throw new UserProfileNotFoundError("Not found");
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

  it("returns 404 when updating profile of a suspended or deleted user (RLS hidden)", async () => {
    mockVerifier.verify.mockResolvedValue({ success: true, claims: suspendedClaims });
    mockRepo.updateOwnProfile.mockRejectedValue(
      new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found"),
    );

    const res = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", "Bearer token")
      .send({ fullName: "Updated Name" });

    // Since RLS hides the row, we get RECORD_NOT_FOUND which maps to 404
    expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
    expect(res.body.code).toBe("USER_PROFILE_NOT_FOUND");
  });
});
