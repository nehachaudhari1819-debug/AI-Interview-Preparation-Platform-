import { describe, it, expect } from "vitest";
import { UpdateUserPreferencesInputSchema } from "../../../../src/features/users/user-preferences.schemas.js";

describe("UpdateUserPreferencesInputSchema", () => {
  it("should validate and normalize a valid locale", () => {
    const input = { locale: "en-US " };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe("en-US");
    }
  });

  it("should reject an invalid locale", () => {
    const input = { locale: "invalid_locale_format_that_is_too_long" };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should validate a valid timeZone", () => {
    const input = { timeZone: " America/New_York " };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeZone).toBe("America/New_York");
    }
  });

  it("should reject an unrecognized timeZone", () => {
    const input = { timeZone: "Invalid/TimeZone" };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept valid boolean flags", () => {
    const input = {
      practiceRemindersEnabled: true,
      weeklyProgressSummaryEnabled: false,
      productUpdatesEnabled: true,
    };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject non-boolean flags", () => {
    const input = { practiceRemindersEnabled: "true" };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should require at least one field", () => {
    const input = {};
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should allow partial updates", () => {
    const input = { locale: "fr" };
    const result = UpdateUserPreferencesInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
