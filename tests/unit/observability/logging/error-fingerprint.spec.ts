import { jest } from "@jest/globals";
import { createErrorFingerprint } from "../../../../src/observability/logging/create-error-fingerprint.js";

describe("Error Fingerprint", () => {
  it("generates consistent hashes for identical errors", () => {
    const hash1 = createErrorFingerprint(new Error("Test error"));
    const hash2 = createErrorFingerprint(new Error("Test error"));
    expect(hash1).toBe(hash2);
  });

  it("generates different hashes for different error types", () => {
    const hash1 = createErrorFingerprint(new TypeError("Test error"));
    const hash2 = createErrorFingerprint(new RangeError("Test error"));
    expect(hash1).not.toBe(hash2);
  });

  it("generates a hash robustly without throwing on missing properties", () => {
    const e1 = new Error("msg") as any;
    delete e1.stack;
    expect(createErrorFingerprint(e1)).toBeDefined();

    const e2 = { message: "Not an error instance" };
    expect(createErrorFingerprint(e2)).toBeDefined();
  });
});
