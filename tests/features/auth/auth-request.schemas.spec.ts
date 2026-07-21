import {
  parseLoginRequest,
  parseRegisterRequest,
} from "../../../src/features/auth/auth-request.schemas.js";
import { ValidationError } from "../../../src/errors/validation.error.js";

describe("Auth Request Schemas", () => {
  describe("parseRegisterRequest", () => {
    it("should return the parsed request for valid input", () => {
      const input = { email: " Test@example.COM ", password: "Password123!" };
      const result = parseRegisterRequest(input);
      expect(result).toEqual({
        email: "test@example.com",
        password: "Password123!",
      });
    });

    it("should throw ValidationError for missing fields", () => {
      expect(() => parseRegisterRequest({})).toThrow();
    });

    it("should throw ValidationError for invalid email", () => {
      expect(() => parseRegisterRequest({ email: "invalid", password: "Password123!" })).toThrow();
    });

    it("should throw ValidationError for short password", () => {
      expect(() =>
        parseRegisterRequest({ email: "test@example.com", password: "short" }),
      ).toThrow();
    });

    it("should strip unknown fields", () => {
      const input = {
        email: "test@example.com",
        password: "Password123!",
        extra: "field",
      };
      // z.strict() should throw on unknown fields
      expect(() => parseRegisterRequest(input)).toThrow();
    });
  });

  describe("parseLoginRequest", () => {
    it("should return the parsed request for valid input", () => {
      const input = { email: " Test@example.COM ", password: "Password123!" };
      const result = parseLoginRequest(input);
      expect(result).toEqual({
        email: "test@example.com",
        password: "Password123!",
      });
    });

    it("should throw ValidationError for missing fields", () => {
      expect(() => parseLoginRequest({})).toThrow();
    });

    it("should throw ValidationError for invalid email", () => {
      expect(() => parseLoginRequest({ email: "invalid", password: "Password123!" })).toThrow();
    });
  });
});
