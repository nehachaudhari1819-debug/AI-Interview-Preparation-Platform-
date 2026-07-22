import { describe, it, expect } from "@jest/globals";
import {
  PersistenceError,
  PersistenceErrorCode,
} from "../../../src/persistence/persistence-error.js";

describe("PersistenceError", () => {
  it("creates an error with the correct code and message", () => {
    const error = new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "User not found");

    expect(error.code).toBe(PersistenceErrorCode.RECORD_NOT_FOUND);
    expect(error.message).toBe("User not found");
    expect(error.name).toBe("PersistenceError");
  });

  describe("is() helper", () => {
    it("identifies a generic PersistenceError", () => {
      const error = new PersistenceError(PersistenceErrorCode.RECORD_NOT_FOUND, "Not found");
      expect(PersistenceError.is(error)).toBe(true);
    });

    it("identifies a specific PersistenceError code", () => {
      const error = new PersistenceError(PersistenceErrorCode.UNAUTHORIZED_ACCESS, "Denied");
      expect(PersistenceError.is(error, PersistenceErrorCode.UNAUTHORIZED_ACCESS)).toBe(true);
      expect(PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)).toBe(false);
    });

    it("returns false for non-PersistenceErrors", () => {
      const error = new Error("Standard error");
      expect(PersistenceError.is(error)).toBe(false);
      expect(PersistenceError.is(error, PersistenceErrorCode.RECORD_NOT_FOUND)).toBe(false);
      expect(PersistenceError.is(null)).toBe(false);
    });
  });
});
