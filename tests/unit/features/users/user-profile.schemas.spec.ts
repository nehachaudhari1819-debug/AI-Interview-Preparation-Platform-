import {
  UserProfileSchema,
  UpdateUserProfileInputSchema,
} from "../../../../src/features/users/user-profile.schemas.js";

describe("User Profile Schemas", () => {
  describe("UserProfileSchema", () => {
    it("validates a complete valid profile", () => {
      const profile = {
        id: "123e4567-e89b-12d3-a456-426614174000",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const result = UserProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it("accepts valid nulls", () => {
      const profile = {
        id: "123e4567-e89b-12d3-a456-426614174000",
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
        deletedAt: new Date(),
      };

      const result = UserProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it("fails if unexpected keys are present", () => {
      const profile = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        fullName: "Test User",
        college: "Test College",
        branch: "CS",
        graduationYear: 2026,
        experienceLevel: "beginner",
        preferredRoles: ["developer"],
        bio: "Test bio",
        avatarUrl: "https://example.com/avatar.png",
        role: "student",
        accountStatus: "active",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        deletedAt: null,
        unexpectedKey: "should fail",
      };

      const result = UserProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe("unrecognized_keys");
      }
    });

    it("rejects invalid UUID", () => {
      const result = UserProfileSchema.safeParse({ id: "invalid-uuid" });
      expect(result.success).toBe(false);
    });

    it("rejects non-HTTPS avatar URLs", () => {
      const profile = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        fullName: "Test User",
        college: null,
        branch: null,
        graduationYear: null,
        experienceLevel: null,
        preferredRoles: [],
        bio: null,
        avatarUrl: "http://example.com/avatar.png", // HTTP
        role: "student",
        accountStatus: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const result = UserProfileSchema.safeParse(profile);
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateUserProfileInputSchema", () => {
    it("accepts a one-field partial update", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        fullName: "New Name",
      });
      expect(result.success).toBe(true);
    });

    it("accepts a full valid update", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        fullName: "Test User",
        college: "Test College",
        branch: "Computer Science",
        graduationYear: 2026,
        experienceLevel: "beginner",
        preferredRoles: ["developer"],
        bio: "Test bio",
        avatarUrl: "https://example.com/avatar.png",
      });
      expect(result.success).toBe(true);
    });

    it("rejects an empty object", () => {
      const result = UpdateUserProfileInputSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects unknown keys", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        unknownField: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects protected keys", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        email: "other@example.test",
      });
      expect(result.success).toBe(false);
    });

    it("trims fullName and rejects empty", () => {
      const resultEmpty = UpdateUserProfileInputSchema.safeParse({
        fullName: "   ",
      });
      expect(resultEmpty.success).toBe(false);

      const resultValid = UpdateUserProfileInputSchema.safeParse({
        fullName: "  Valid Name  ",
      });
      expect(resultValid.success).toBe(true);
      if (resultValid.success) {
        expect(resultValid.data.fullName).toBe("Valid Name");
      }
    });

    it("normalizes optional empty strings to null", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        college: "   ",
        branch: "",
        bio: "   ",
        avatarUrl: "",
        fullName: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.college).toBeNull();
        expect(result.data.branch).toBeNull();
        expect(result.data.bio).toBeNull();
        expect(result.data.avatarUrl).toBeNull();
      }
    });

    it("validates graduation year bounds", () => {
      const resultLow = UpdateUserProfileInputSchema.safeParse({
        graduationYear: 1999,
        fullName: "Test",
      });
      expect(resultLow.success).toBe(false);

      const resultHigh = UpdateUserProfileInputSchema.safeParse({
        graduationYear: 2101,
        fullName: "Test",
      });
      expect(resultHigh.success).toBe(false);

      const resultString = UpdateUserProfileInputSchema.safeParse({
        graduationYear: "2026",
        fullName: "Test",
      });
      expect(resultString.success).toBe(false);
    });

    it("deduplicates preferred roles and preserves order", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        preferredRoles: [" b ", "a", " b "],
        fullName: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.preferredRoles).toEqual(["b", "a"]);
      }
    });

    it("rejects empty preferred role after trimming", () => {
      const result = UpdateUserProfileInputSchema.safeParse({
        preferredRoles: ["a", "   "],
        fullName: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects HTTP, JavaScript, data, relative URLs for avatarUrl", () => {
      const invalidUrls = [
        "http://example.com/a.png",
        "javascript:alert(1)",
        "data:image/png;base64,iVBORw",
        "ftp://example.com",
        "/relative/path.png",
      ];
      for (const url of invalidUrls) {
        const result = UpdateUserProfileInputSchema.safeParse({
          avatarUrl: url,
          fullName: "Test",
        });
        expect(result.success).toBe(false);
      }
    });

    it("preserves internal newlines in bio", () => {
      const bio = "Line 1\nLine 2";
      const result = UpdateUserProfileInputSchema.safeParse({
        bio,
        fullName: "Test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.bio).toBe(bio);
      }
    });
  });
});
