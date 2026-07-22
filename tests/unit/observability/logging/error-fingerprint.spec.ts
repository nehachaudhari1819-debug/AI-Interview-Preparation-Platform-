import { jest } from "@jest/globals";
import { generateErrorFingerprint } from "../../../../src/observability/logging/error-fingerprint.js";

describe("Error Fingerprint", () => {
  it("generates consistent hashes for identical errors", () => {
    const hash1 = generateErrorFingerprint(new Error("Test error"));
    const hash2 = generateErrorFingerprint(new Error("Test error"));
    expect(hash1).toBe(hash2);
  });

  it("generates different hashes for different error types", () => {
    const hash1 = generateErrorFingerprint(new TypeError("Test error"));
    const hash2 = generateErrorFingerprint(new RangeError("Test error"));
    expect(hash1).not.toBe(hash2);
  });
  
  it("generates a hash robustly without throwing on missing properties", () => {
    const e1 = new Error("msg");
    e1.stack = undefined;
    expect(generateErrorFingerprint(e1)).toBeDefined();
    
    const e2 = { message: "Not an error instance" };
    expect(generateErrorFingerprint(e2 as any)).toBeDefined();
  });
});
