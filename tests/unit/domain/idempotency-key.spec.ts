import {
  parseIdempotencyKey,
  IDEMPOTENCY_KEY_MAX_LENGTH,
} from "../../../src/domain/idempotency/idempotency-key.js";

describe("parseIdempotencyKey", () => {
  describe("missing", () => {
    it("returns missing when value is undefined", () => {
      expect(parseIdempotencyKey(undefined)).toEqual({ ok: false, reason: "missing" });
    });

    it("returns missing when value is null", () => {
      expect(parseIdempotencyKey(null as any)).toEqual({ ok: false, reason: "missing" });
    });
  });

  describe("duplicate_header", () => {
    it("returns duplicate_header when value is an array", () => {
      expect(parseIdempotencyKey(["key-a", "key-b"])).toEqual({
        ok: false,
        reason: "duplicate_header",
      });
    });

    it("returns duplicate_header for a single-element array", () => {
      expect(parseIdempotencyKey(["key-a"])).toEqual({
        ok: false,
        reason: "duplicate_header",
      });
    });
  });

  describe("empty", () => {
    it("returns empty when value is an empty string", () => {
      expect(parseIdempotencyKey("")).toEqual({ ok: false, reason: "empty" });
    });
  });

  describe("control_characters", () => {
    it("returns control_characters for NUL byte", () => {
      expect(parseIdempotencyKey("key\x00val")).toEqual({
        ok: false,
        reason: "control_characters",
      });
    });

    it("returns control_characters for newline", () => {
      expect(parseIdempotencyKey("key\nval")).toEqual({
        ok: false,
        reason: "control_characters",
      });
    });

    it("returns control_characters for tab", () => {
      expect(parseIdempotencyKey("key\tval")).toEqual({
        ok: false,
        reason: "control_characters",
      });
    });

    it("returns control_characters for DEL (0x7F)", () => {
      expect(parseIdempotencyKey("key\x7Fval")).toEqual({
        ok: false,
        reason: "control_characters",
      });
    });
  });

  describe("too_long", () => {
    it("returns too_long when key exceeds max length", () => {
      const key = "x".repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1);
      expect(parseIdempotencyKey(key)).toEqual({ ok: false, reason: "too_long" });
    });

    it("accepts a key exactly at max length", () => {
      const key = "x".repeat(IDEMPOTENCY_KEY_MAX_LENGTH);
      expect(parseIdempotencyKey(key)).toEqual({ ok: true, key });
    });
  });

  describe("valid", () => {
    it("returns the key for a simple alphanumeric value", () => {
      expect(parseIdempotencyKey("abc-123")).toEqual({ ok: true, key: "abc-123" });
    });

    it("returns the key for a UUID format value", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      expect(parseIdempotencyKey(uuid)).toEqual({ ok: true, key: uuid });
    });

    it("does not strip or transform the key value", () => {
      const key = "  key with spaces  ";
      expect(parseIdempotencyKey(key)).toEqual({ ok: true, key });
    });
  });
});
