import {
  normalizeOptionalString,
  normalizeRequiredString,
  normalizePreferredRoles,
} from "../../../../src/features/users/user-profile.normalizers.js";

describe("User Profile Normalizers", () => {
  describe("normalizeOptionalString", () => {
    it("trims whitespace from a string", () => {
      expect(normalizeOptionalString("  hello  ")).toBe("hello");
    });

    it("returns null for an empty string after trimming", () => {
      expect(normalizeOptionalString("   ")).toBeNull();
      expect(normalizeOptionalString("")).toBeNull();
    });

    it("returns null for null or undefined", () => {
      expect(normalizeOptionalString(null)).toBeNull();
      expect(normalizeOptionalString(undefined)).toBeNull();
    });
  });

  describe("normalizeRequiredString", () => {
    it("trims whitespace from a string", () => {
      expect(normalizeRequiredString("  hello  ")).toBe("hello");
    });
  });

  describe("normalizePreferredRoles", () => {
    it("normalizes null or undefined to an empty array", () => {
      expect(normalizePreferredRoles(null)).toEqual([]);
      expect(normalizePreferredRoles(undefined)).toEqual([]);
    });

    it("trims whitespace from each role", () => {
      expect(normalizePreferredRoles(["  admin  ", " student "])).toEqual(["admin", "student"]);
    });

    it("deduplicates roles while preserving order", () => {
      expect(
        normalizePreferredRoles([
          " backend-developer ",
          "backend-developer",
          " embedded-engineer ",
        ]),
      ).toEqual(["backend-developer", "embedded-engineer"]);
    });

    it("preserves empty strings to let schema validation handle them", () => {
      expect(normalizePreferredRoles(["   ", "role"])).toEqual(["", "role"]);
    });
  });
});
