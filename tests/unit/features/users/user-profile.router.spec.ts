import { jest } from "@jest/globals";
import express from "express";
import request from "supertest";
import { createUserProfileRouter } from "../../../../src/features/users/user-profile.router.js";
import type { UserProfileService } from "../../../../src/features/users/user-profile.service.js";
import type { ApplicationConfig } from "../../../../src/config/app-config.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";
import type { UserProfile } from "../../../../src/features/users/user-profile.types.js";

describe("UserProfileRouter", () => {
  let mockService: jest.Mocked<UserProfileService>;
  let mockAuthMiddleware: express.RequestHandler;
  let app: express.Express;

  const validProfile: UserProfile = {
    id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
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
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null,
  };

  beforeEach(() => {
    mockService = {
      getCurrentUserProfile: jest.fn<any>(),
      updateCurrentUserProfile: jest.fn<any>(),
    } as unknown as jest.Mocked<UserProfileService>;

    mockAuthMiddleware = (req, res, next) => {
      req.context = {
        requestId: "req-123",
        authentication: {
          state: "authenticated",
          principal: { userId: "d290f1ee-6c54-4b01-90e6-d701748f0851" },
        },
      } as any;
      next();
    };

    const config = {
      rateLimits: {
        authSession: { enabled: false, windowMs: 60000, maxRequests: 100 },
        ipv6Subnet: 56,
      },
    } as ApplicationConfig;

    const router = createUserProfileRouter({
      config,
      authMiddleware: mockAuthMiddleware,
      activeAccountMiddleware: (req, res, next) => next(),
      serviceMiddleware: (req, res, next) => {
        res.locals.userProfileService = mockService;
        next();
      },
    });

    app = express();
    app.use(express.json());
    app.use("/api/v1/users", router);
  });

  it("GET /api/v1/users/me returns 200 with the profile", async () => {
    mockService.getCurrentUserProfile.mockResolvedValue(validProfile);

    const response = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token");

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.id).toBe(validProfile.id);
  });

  it("PATCH /api/v1/users/me returns 200 with the updated profile", async () => {
    const updatedProfile = { ...validProfile, fullName: "Updated Name" };
    mockService.updateCurrentUserProfile.mockResolvedValue(updatedProfile);

    const response = await request(app)
      .patch("/api/v1/users/me")
      .set("Authorization", "Bearer valid-token")
      .send({ fullName: "Updated Name" });

    expect(response.status).toBe(HTTP_STATUS.OK);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.fullName).toBe("Updated Name");
    expect(mockService.updateCurrentUserProfile).toHaveBeenCalledWith(
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
      { fullName: "Updated Name" },
    );
  });
});
