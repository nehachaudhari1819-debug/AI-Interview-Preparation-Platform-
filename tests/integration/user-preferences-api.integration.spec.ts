import { jest } from "@jest/globals";
import request from "supertest";
import { Router } from "express";
import { createApp } from "../../src/app.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";
import { createAuthenticationMiddleware } from "../../src/auth/create-authentication-middleware.js";
import { createUserPreferencesRouter } from "../../src/features/users/user-preferences.router.js";
import type { AccessTokenVerifier } from "../../src/auth/supabase-access-token-verifier.js";
import type { UserPreferencesRepository } from "../../src/persistence/users/user-preferences.repository.js";
import type { UserProfileRepository } from "../../src/persistence/users/user-profile.repository.js";
import { UserPreferencesService } from "../../src/features/users/user-preferences.service.js";
import { HTTP_STATUS } from "../../src/constants/http.constants.js";

describe("UserPreferences API Integration", () => {
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
    session_id: "c290f1ee-6c54-4b01-90e6-d701748f0852",
    is_anonymous: false,
  };

  const mockPref = {
    locale: "en",
    timeZone: "UTC",
    practiceRemindersEnabled: false,
    weeklyProgressSummaryEnabled: false,
    productUpdatesEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockVerifier: jest.Mocked<AccessTokenVerifier>;
  let mockRepo: jest.Mocked<UserPreferencesRepository>;
  let mockProfileRepo: jest.Mocked<UserProfileRepository>;
  let app: any;

  beforeEach(() => {
    mockVerifier = { verify: jest.fn<any>() };
    mockRepo = {
      findByUserId: jest.fn<any>(),
      updateByUserId: jest.fn<any>(),
    };
    mockProfileRepo = {
      findById: jest.fn<any>(),
    } as any;

    const authMiddleware = createAuthenticationMiddleware({
      config,
      verifier: mockVerifier,
      now: () => Date.now(),
    });

    const activeAccountMiddleware = (req: any, res: any, next: any) => {
      void mockProfileRepo
        .findById(req.context.authentication.principal.userId)
        .then((profile: any) => {
          if (!profile || profile.accountStatus === "missing") {
            return res.status(401).json({ code: "USER_PROFILE_NOT_FOUND" });
          }
          if (profile.accountStatus === "suspended") {
            return res.status(403).json({ code: "ACCOUNT_DISABLED" });
          }
          if (profile.accountStatus === "deletion_pending") {
            return res.status(403).json({ code: "ACCOUNT_DEACTIVATED" });
          }
          if (profile.accountStatus === "deleted") {
            return res.status(403).json({ code: "ACCOUNT_DELETED" });
          }
          next();
        })
        .catch(next);
    };

    const service = new UserPreferencesService(mockRepo);
    const serviceMiddleware = (req: any, res: any, next: any) => {
      res.locals.userPreferencesService = service;
      next();
    };

    const preferencesRouter = createUserPreferencesRouter({
      config,
      authMiddleware,
      activeAccountMiddleware,
      serviceMiddleware,
    });

    const apiRouter = Router();
    apiRouter.use("/users/me/preferences", preferencesRouter);

    app = createApp({ config, apiRouter });
  });

  describe("Authentication & Authorization", () => {
    it("Unauthenticated request returns 401", async () => {
      mockVerifier.verify.mockResolvedValue({ success: false, error: "Missing token" } as any);
      const res = await request(app).get("/api/v1/users/me/preferences");
      expect(res.status).toBe(HTTP_STATUS.UNAUTHORIZED);
    });

    it("Suspended account returns 403", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockProfileRepo.findById.mockResolvedValue({ accountStatus: "suspended" } as any);

      const res = await request(app)
        .get("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.code).toBe("ACCOUNT_DISABLED");
    });

    it("Deletion-pending account returns 403", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockProfileRepo.findById.mockResolvedValue({ accountStatus: "deletion_pending" } as any);

      const res = await request(app)
        .get("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.code).toBe("ACCOUNT_DEACTIVATED");
    });

    it("Deleted account returns 403", async () => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockProfileRepo.findById.mockResolvedValue({ accountStatus: "deleted" } as any);

      const res = await request(app)
        .get("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(HTTP_STATUS.FORBIDDEN);
      expect(res.body.code).toBe("ACCOUNT_DELETED");
    });
  });

  describe("GET /api/v1/users/me/preferences", () => {
    beforeEach(() => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockProfileRepo.findById.mockResolvedValue({ accountStatus: "active" } as any);
    });

    it("Authenticated active user retrieves preferences with no-store cache control", async () => {
      mockRepo.findByUserId.mockResolvedValue(mockPref);

      const res = await request(app)
        .get("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body.data.locale).toBe("en");
      expect(res.body.data).not.toHaveProperty("userId");
      expect(res.body.data).not.toHaveProperty("user_id");
      expect(mockRepo.findByUserId).toHaveBeenCalledWith(validClaims.sub);
    });

    it("returns 404 if preferences not found (database failure maps safely)", async () => {
      mockRepo.findByUserId.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token");

      expect(res.status).toBe(HTTP_STATUS.NOT_FOUND);
      expect(res.body.code).toBe("RESOURCE_NOT_FOUND");
    });
  });

  describe("PATCH /api/v1/users/me/preferences", () => {
    beforeEach(() => {
      mockVerifier.verify.mockResolvedValue({ success: true, claims: validClaims });
      mockProfileRepo.findById.mockResolvedValue({ accountStatus: "active" } as any);
    });

    it("Valid one-field PATCH succeeds", async () => {
      mockRepo.updateByUserId.mockResolvedValue({ ...mockPref, locale: "fr" });

      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "fr" });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body.data.locale).toBe("fr");
      expect(mockRepo.updateByUserId).toHaveBeenCalledWith(validClaims.sub, { locale: "fr" });
    });

    it("Valid multi-field PATCH succeeds", async () => {
      mockRepo.updateByUserId.mockResolvedValue({
        ...mockPref,
        locale: "fr",
        timeZone: "Europe/Paris",
        practiceRemindersEnabled: true,
      });

      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "fr", timeZone: "Europe/Paris", practiceRemindersEnabled: true });

      expect(res.status).toBe(HTTP_STATUS.OK);
      expect(mockRepo.updateByUserId).toHaveBeenCalledWith(validClaims.sub, {
        locale: "fr",
        timeZone: "Europe/Paris",
        practiceRemindersEnabled: true,
      });
    });

    it("Empty PATCH is rejected", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({});

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(mockRepo.updateByUserId).not.toHaveBeenCalled();
    });

    it("Unknown field is rejected", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "en", unknownField: true });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("Invalid locale is rejected", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "invalid-locale-format!" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("Invalid time zone is rejected", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ timeZone: "Mars/Phobos" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("Invalid Boolean is rejected", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ practiceRemindersEnabled: "true" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("Request body cannot override ownership", async () => {
      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "en", userId: "hacker-id", user_id: "hacker-id" });

      expect(res.status).toBe(HTTP_STATUS.BAD_REQUEST);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      // ensure we still only pass allowed fields down
      expect(mockRepo.updateByUserId).not.toHaveBeenCalled();
    });

    it("Database failure maps safely", async () => {
      mockRepo.updateByUserId.mockRejectedValue(new Error("Database connection failed"));

      const res = await request(app)
        .patch("/api/v1/users/me/preferences")
        .set("Authorization", "Bearer token")
        .send({ locale: "en" });

      expect(res.status).toBe(HTTP_STATUS.INTERNAL_SERVER_ERROR);
      // Actual error should be redacted
      expect(res.body.message).not.toContain("Database connection failed");
    });
  });
});
