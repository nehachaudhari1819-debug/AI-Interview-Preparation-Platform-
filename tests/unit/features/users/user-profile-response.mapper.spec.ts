import { mapUserProfileToResponse } from "../../../../src/features/users/user-profile-response.mapper.js";
import type { UserProfile } from "../../../../src/features/users/user-profile.types.js";

describe("User Profile Response Mapper", () => {
  it("maps canonical profile to safe API response, excluding deletedAt and formatting dates", () => {
    const canonicalProfile: UserProfile = {
      id: "d290f1ee-6c54-4b01-90e6-d701748f0851",
      email: "test@example.com",
      fullName: "Test User",
      college: "Test College",
      branch: "Computer Science",
      graduationYear: 2026,
      experienceLevel: "beginner",
      preferredRoles: ["developer"],
      bio: "Test bio",
      avatarUrl: "https://example.com/avatar.png",
      role: "student",
      accountStatus: "active",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      deletedAt: new Date("2026-01-01T00:00:00.000Z"), // Should be excluded
    };

    const response = mapUserProfileToResponse(canonicalProfile);

    expect(response.id).toBe(canonicalProfile.id);
    expect(response.email).toBe(canonicalProfile.email);
    expect(response.fullName).toBe(canonicalProfile.fullName);
    expect(response.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(response.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect((response as any).deletedAt).toBeUndefined();
  });
});
