import { normalizeOrigin, isTrustedOrigin } from "../../../src/security/trusted-origin.js";
import { ConfigurationError } from "../../../src/errors/configuration.error.js";

describe("trusted-origin utilities", () => {
  describe("normalizeOrigin", () => {
    it("returns origin for valid http URL", () => {
      expect(normalizeOrigin("http://localhost:5173/path")).toBe("http://localhost:5173");
    });

    it("returns origin for valid https URL", () => {
      expect(normalizeOrigin("https://app.example.com:443/")).toBe("https://app.example.com");
    });

    it("throws ConfigurationError for invalid protocol", () => {
      expect(() => normalizeOrigin("ftp://example.com")).toThrow(ConfigurationError);
    });

    it("throws ConfigurationError for embedded credentials", () => {
      expect(() => normalizeOrigin("https://user:pass@example.com")).toThrow(ConfigurationError);
    });
  });

  describe("isTrustedOrigin", () => {
    const allowedOrigins = ["https://app.example.com", "http://localhost:5173"];

    it("returns false for 'null' origin", () => {
      expect(isTrustedOrigin("null", allowedOrigins)).toBe(false);
    });

    it("returns true for exactly matching origin", () => {
      expect(isTrustedOrigin("https://app.example.com", allowedOrigins)).toBe(true);
    });

    it("returns false for mismatched subdomain", () => {
      expect(isTrustedOrigin("https://malicious.example.com", allowedOrigins)).toBe(false);
    });

    it("returns false for embedded credentials", () => {
      expect(isTrustedOrigin("https://user:pass@app.example.com", allowedOrigins)).toBe(false);
    });

    it("returns false for invalid URL", () => {
      expect(isTrustedOrigin("not-a-url", allowedOrigins)).toBe(false);
    });
  });
});
