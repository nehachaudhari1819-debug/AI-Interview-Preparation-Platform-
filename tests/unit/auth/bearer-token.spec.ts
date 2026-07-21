import type { Request } from "express";
import {
  extractBearerToken,
  readSingleAuthorizationHeader,
} from "../../../src/auth/bearer-token.js";
import { MAX_BEARER_TOKEN_LENGTH } from "../../../src/auth/auth.constants.js";
import { InvalidAuthorizationHeaderError } from "../../../src/errors/invalid-authorization-header.error.js";

describe("Bearer Token Parser", () => {
  describe("extractBearerToken", () => {
    it("returns missing for undefined header", () => {
      expect(extractBearerToken(undefined)).toEqual({ status: "missing" });
    });

    it("returns missing for empty string", () => {
      expect(extractBearerToken("")).toEqual({ status: "missing" });
      expect(extractBearerToken("   ")).toEqual({ status: "missing" });
    });

    it("extracts standard Bearer token", () => {
      expect(extractBearerToken("Bearer token123")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("accepts lowercase scheme", () => {
      expect(extractBearerToken("bearer token123")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("accepts uppercase scheme", () => {
      expect(extractBearerToken("BEARER token123")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("normalizes surrounding harmless whitespace", () => {
      expect(extractBearerToken("  Bearer token123  ")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("accepts multiple spaces after Bearer", () => {
      expect(extractBearerToken("Bearer    token123")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("accepts tab separator", () => {
      expect(extractBearerToken("Bearer\ttoken123")).toEqual({
        status: "present",
        token: "token123",
      });
    });

    it("rejects Bearer without token", () => {
      expect(extractBearerToken("Bearer")).toEqual({ status: "missing" });
      expect(extractBearerToken("Bearer ")).toEqual({ status: "missing" });
    });

    it("rejects Basic scheme", () => {
      expect(extractBearerToken("Basic token123")).toEqual({ status: "missing" });
    });

    it("rejects raw token without scheme", () => {
      expect(extractBearerToken("token123")).toEqual({ status: "missing" });
    });

    it("rejects comma-separated credentials", () => {
      expect(extractBearerToken("Bearer token1, token2")).toEqual({ status: "missing" });
    });

    it("rejects two token segments", () => {
      expect(extractBearerToken("Bearer token1 token2")).toEqual({ status: "missing" });
    });

    it("rejects internal token whitespace", () => {
      expect(extractBearerToken("Bearer tok en")).toEqual({ status: "missing" });
    });

    it("rejects CR", () => {
      expect(extractBearerToken("Bearer token\r")).toEqual({ status: "missing" });
    });

    it("rejects LF", () => {
      expect(extractBearerToken("Bearer token\n")).toEqual({ status: "missing" });
    });

    it("rejects null byte", () => {
      expect(extractBearerToken("Bearer token\0")).toEqual({ status: "missing" });
    });

    it("rejects control characters", () => {
      expect(extractBearerToken("Bearer token\x07")).toEqual({ status: "missing" });
    });

    it("rejects oversized token", () => {
      const hugeToken = "Bearer " + "a".repeat(MAX_BEARER_TOKEN_LENGTH + 1);
      expect(extractBearerToken(hugeToken)).toEqual({ status: "missing" });
    });
  });

  describe("readSingleAuthorizationHeader", () => {
    it("returns undefined when no authorization header exists", () => {
      const req = { rawHeaders: [] } as unknown as Request;
      expect(readSingleAuthorizationHeader(req)).toBeUndefined();
    });

    it("returns the header when exactly one exists", () => {
      const req = { rawHeaders: ["Authorization", "Bearer foo"] } as unknown as Request;
      expect(readSingleAuthorizationHeader(req)).toBe("Bearer foo");
    });

    it("rejects duplicate Authorization headers", () => {
      const req = {
        rawHeaders: ["Authorization", "Bearer foo", "authorization", "Bearer bar"],
      } as unknown as Request;
      expect(() => readSingleAuthorizationHeader(req)).toThrow(InvalidAuthorizationHeaderError);
    });

    it("header-name casing does not bypass duplicate detection", () => {
      const req = {
        rawHeaders: ["AUTHORIZATION", "Bearer foo", "AuThOrIzAtIoN", "Bearer bar"],
      } as unknown as Request;
      expect(() => readSingleAuthorizationHeader(req)).toThrow(InvalidAuthorizationHeaderError);
    });
  });
});
