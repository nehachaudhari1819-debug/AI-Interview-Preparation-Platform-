import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import { createGetMeController } from "../../../../src/features/users/user-profile.controller.js";
import type { UserProfileService } from "../../../../src/features/users/user-profile.service.js";
import { HTTP_STATUS } from "../../../../src/constants/http.constants.js";
import type { UserProfile } from "../../../../src/features/users/user-profile.types.js";
import type { AuthenticatedPrincipal } from "../../../../src/auth/authentication.types.js";

describe("GetMeController", () => {
  let mockService: jest.Mocked<UserProfileService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const validPrincipal: AuthenticatedPrincipal = {
    userId: "d290f1ee-6c54-4b01-90e6-d701748f0851",
    sessionId: "e440f1ee-6c54-4b01-90e6-d701748f0852",
    issuer: "https://example.com",
    audiences: ["authenticated"],
    postgresRole: "authenticated",
    assuranceLevel: "aal1",
    issuedAt: 1000,
    expiresAt: 2000,
    isAnonymous: false,
    email: "test@example.com",
    phone: undefined,
    applicationRole: null,
    accountStatus: "active",
  };

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
    } as unknown as jest.Mocked<UserProfileService>;

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    req = {
      headers: {
        authorization: "Bearer valid-token",
      },
      context: {
        requestId: "req-123",
        authentication: {
          state: "authenticated",
          principal: validPrincipal,
        },
      } as any,
    };

    res = {
      status: statusMock as any,
      locals: {},
    };
  });

  it("returns 200 with the mapped profile", async () => {
    mockService.getCurrentUserProfile.mockResolvedValue(validProfile);

    const handler = createGetMeController(() => mockService);
    await handler(req as Request, res as Response, jest.fn());

    expect(mockService.getCurrentUserProfile).toHaveBeenCalledWith(validPrincipal.userId);
    expect(statusMock).toHaveBeenCalledWith(HTTP_STATUS.OK);
    expect(jsonMock).toHaveBeenCalledWith({
      success: true,
      data: {
        user: {
          id: validProfile.id,
          email: validProfile.email,
          fullName: validProfile.fullName,
          college: null,
          branch: null,
          graduationYear: null,
          experienceLevel: null,
          preferredRoles: [],
          bio: null,
          avatarUrl: null,
          role: "student",
          accountStatus: "active",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      meta: {
        requestId: "req-123",
      },
    });
  });
});
