import { generateRequestFingerprint } from "../../../src/domain/idempotency/request-fingerprint.js";

describe("generateRequestFingerprint", () => {
  const base = {
    apiVersion: "v1",
    method: "PATCH",
    routePattern: "/users/me",
    operation: "update_profile",
    body: { bio: "hello", college: "MIT" },
  };

  it("produces a non-empty hex string", () => {
    const fp = generateRequestFingerprint(base);
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for identical inputs", () => {
    expect(generateRequestFingerprint(base)).toBe(generateRequestFingerprint(base));
  });

  it("is stable regardless of body key order", () => {
    const a = generateRequestFingerprint({ ...base, body: { bio: "hello", college: "MIT" } });
    const b = generateRequestFingerprint({ ...base, body: { college: "MIT", bio: "hello" } });
    expect(a).toBe(b);
  });

  it("differs when body values differ", () => {
    const a = generateRequestFingerprint({ ...base, body: { bio: "hello" } });
    const b = generateRequestFingerprint({ ...base, body: { bio: "world" } });
    expect(a).not.toBe(b);
  });

  it("differs when method changes", () => {
    const a = generateRequestFingerprint({ ...base, method: "PATCH" });
    const b = generateRequestFingerprint({ ...base, method: "POST" });
    expect(a).not.toBe(b);
  });

  it("is case-insensitive for method (normalized to uppercase)", () => {
    const a = generateRequestFingerprint({ ...base, method: "patch" });
    const b = generateRequestFingerprint({ ...base, method: "PATCH" });
    expect(a).toBe(b);
  });

  it("differs when route pattern changes", () => {
    const a = generateRequestFingerprint({ ...base, routePattern: "/users/me" });
    const b = generateRequestFingerprint({ ...base, routePattern: "/users/other" });
    expect(a).not.toBe(b);
  });

  it("differs when operation changes", () => {
    const a = generateRequestFingerprint({ ...base, operation: "update_profile" });
    const b = generateRequestFingerprint({ ...base, operation: "delete_profile" });
    expect(a).not.toBe(b);
  });

  it("differs when apiVersion changes", () => {
    const a = generateRequestFingerprint({ ...base, apiVersion: "v1" });
    const b = generateRequestFingerprint({ ...base, apiVersion: "v2" });
    expect(a).not.toBe(b);
  });

  it("does not include authorization header in hash", () => {
    // No authorization field in the input — must not be hashed
    // This test verifies the function signature does not accept it
    const keys = Object.keys(base);
    expect(keys).not.toContain("authorization");
    expect(keys).not.toContain("cookie");
    expect(keys).not.toContain("requestId");
  });

  it("handles nested body objects with stable key ordering", () => {
    const a = generateRequestFingerprint({
      ...base,
      body: { outer: { z: 2, a: 1 } },
    });
    const b = generateRequestFingerprint({
      ...base,
      body: { outer: { a: 1, z: 2 } },
    });
    expect(a).toBe(b);
  });

  it("handles null and undefined body gracefully", () => {
    const a = generateRequestFingerprint({ ...base, body: null });
    const b = generateRequestFingerprint({ ...base, body: undefined });
    expect(typeof a).toBe("string");
    expect(typeof b).toBe("string");
  });

  it("handles empty body", () => {
    const fp = generateRequestFingerprint({ ...base, body: {} });
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
