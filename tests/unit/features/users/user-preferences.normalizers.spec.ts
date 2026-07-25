import { describe, it, expect } from "vitest";
import {
  normalizeLocale,
  normalizeTimeZone,
} from "../../../../src/features/users/user-preferences.normalizers.js";

describe("normalizeLocale", () => {
  it("should trim and normalize case", () => {
    expect(normalizeLocale(" en-us ")).toBe("en-US");
    expect(normalizeLocale("FR")).toBe("fr");
  });

  it("should return trimmed string if Intl fails", () => {
    expect(normalizeLocale(" invalid ")).toBe("invalid");
  });
});

describe("normalizeTimeZone", () => {
  it("should trim timezone", () => {
    expect(normalizeTimeZone(" UTC ")).toBe("UTC");
    expect(normalizeTimeZone("America/New_York ")).toBe("America/New_York");
  });
});
