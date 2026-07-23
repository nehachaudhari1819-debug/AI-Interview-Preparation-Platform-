import {
  mapUserProfileRowToDomain,
  mapUserProfileUpdateToDatabase,
} from "../../../src/persistence/users/user-profile.mapper.js";
import {
  PersistenceError,
  PersistenceErrorCode,
} from "../../../src/persistence/persistence-error.js";
import type { Database } from "../../../src/persistence/database.types.js";

describe("User Profile Mapper", () => {
  describe("mapUserProfileRowToDomain", () => {
    it("maps every snake_case field correctly to camelCase", () => {
      const row: Database["public"]["Tables"]["users"]["Row"] = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        full_name: "Test User",
        college: "Test College",
        branch: "CS",
        graduation_year: 2026,
        experience_level: "beginner",
        preferred_roles: ["developer"],
        bio: "Test bio",
        avatar_url: "https://example.com/avatar.png",
        role: "student",
        account_status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      };

      const domain = mapUserProfileRowToDomain(row);

      expect(domain.id).toBe(row.id);
      expect(domain.email).toBe(row.email);
      expect(domain.fullName).toBe(row.full_name);
      expect(domain.college).toBe(row.college);
      expect(domain.branch).toBe(row.branch);
      expect(domain.graduationYear).toBe(row.graduation_year);
      expect(domain.experienceLevel).toBe(row.experience_level);
      expect(domain.preferredRoles).toEqual(row.preferred_roles);
      expect(domain.bio).toBe(row.bio);
      expect(domain.avatarUrl).toBe(row.avatar_url);
      expect(domain.role).toBe(row.role);
      expect(domain.accountStatus).toBe(row.account_status);
      expect(domain.createdAt).toBeInstanceOf(Date);
      expect(domain.updatedAt).toBeInstanceOf(Date);
      expect(domain.deletedAt).toBeNull();

      // No snake_case fields should remain
      expect((domain as any).full_name).toBeUndefined();
    });

    it("maps preferred_roles null to an empty array", () => {
      const row = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        full_name: "Test User",
        college: null,
        branch: null,
        graduation_year: null,
        experience_level: null,
        preferred_roles: null,
        bio: null,
        avatar_url: null,
        role: "student",
        account_status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      } as Database["public"]["Tables"]["users"]["Row"];

      const domain = mapUserProfileRowToDomain(row);
      expect(domain.preferredRoles).toEqual([]);
    });

    it("throws VALIDATION_FAILED for invalid timestamps safely", () => {
      const row = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "test@example.com",
        full_name: "Test User",
        college: null,
        branch: null,
        graduation_year: null,
        experience_level: null,
        preferred_roles: [],
        bio: null,
        avatar_url: null,
        role: "student",
        account_status: "active",
        created_at: "invalid-date",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      } as any as Database["public"]["Tables"]["users"]["Row"];

      expect(() => mapUserProfileRowToDomain(row)).toThrow(
        new PersistenceError(
          PersistenceErrorCode.VALIDATION_FAILED,
          "Database returned an invalid user profile format",
        ),
      );
    });

    it("throws VALIDATION_FAILED safely without exposing raw rows", () => {
      const row = {
        id: "invalid-uuid", // Will fail schema validation
        email: "test@example.com",
        full_name: "Test User",
        college: null,
        branch: null,
        graduation_year: null,
        experience_level: null,
        preferred_roles: [],
        bio: null,
        avatar_url: null,
        role: "student",
        account_status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      } as Database["public"]["Tables"]["users"]["Row"];

      expect(() => mapUserProfileRowToDomain(row)).toThrow(
        new PersistenceError(
          PersistenceErrorCode.VALIDATION_FAILED,
          "Database returned an invalid user profile format",
        ),
      );
    });
  });

  describe("mapUserProfileUpdateToDatabase", () => {
    it("includes only provided editable fields in snake_case", () => {
      const update = {
        fullName: "New Name",
        graduationYear: 2027,
      };

      const dbUpdate = mapUserProfileUpdateToDatabase(update);

      expect(dbUpdate).toEqual({
        full_name: "New Name",
        graduation_year: 2027,
      });
      // Undefined fields should be omitted
      expect("college" in dbUpdate).toBe(false);
    });

    it("preserves explicit null values", () => {
      const update = {
        college: null,
        bio: null,
      };

      const dbUpdate = mapUserProfileUpdateToDatabase(update);

      expect(dbUpdate).toEqual({
        college: null,
        bio: null,
      });
    });

    it("structurally ignores protected fields", () => {
      const update = {
        fullName: "New Name",
        email: "protected@example.com",
        role: "admin",
      } as any;

      const dbUpdate = mapUserProfileUpdateToDatabase(update);

      expect(dbUpdate).toEqual({
        full_name: "New Name",
      });
      expect((dbUpdate as any).email).toBeUndefined();
      expect((dbUpdate as any).role).toBeUndefined();
    });
  });
});
