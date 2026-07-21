import {
  emptyStringToUndefined,
  parseBoolean,
  parseInteger,
} from "../../src/config/environment-parsers.js";

describe("Environment Parsers", () => {
  describe("emptyStringToUndefined", () => {
    it("converts empty strings to undefined", () => {
      expect(emptyStringToUndefined("")).toBeUndefined();
      expect(emptyStringToUndefined("   ")).toBeUndefined();
    });

    it("preserves non-empty strings", () => {
      expect(emptyStringToUndefined("value")).toBe("value");
      expect(emptyStringToUndefined(" value ")).toBe(" value ");
    });

    it("preserves non-string values", () => {
      expect(emptyStringToUndefined(null)).toBeNull();
      expect(emptyStringToUndefined(123)).toBe(123);
      expect(emptyStringToUndefined(undefined)).toBeUndefined();
    });
  });

  describe("parseBoolean", () => {
    it("parses valid true strings", () => {
      expect(parseBoolean("true")).toBe(true);
      expect(parseBoolean("TRUE")).toBe(true);
      expect(parseBoolean("1")).toBe(true);
    });

    it("parses valid false strings", () => {
      expect(parseBoolean("false")).toBe(false);
      expect(parseBoolean("FALSE")).toBe(false);
      expect(parseBoolean("0")).toBe(false);
    });

    it("preserves invalid strings for Zod to reject", () => {
      expect(parseBoolean("yes")).toBe("yes");
      expect(parseBoolean("no")).toBe("no");
      expect(parseBoolean("on")).toBe("on");
      expect(parseBoolean("off")).toBe("off");
      expect(parseBoolean("")).toBe("");
    });

    it("handles native booleans and numbers", () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
      expect(parseBoolean(1)).toBe(true);
      expect(parseBoolean(0)).toBe(false);
    });
  });

  describe("parseInteger", () => {
    it("parses valid integers", () => {
      expect(parseInteger("5000")).toBe(5000);
      expect(parseInteger("1")).toBe(1);
      expect(parseInteger("65535")).toBe(65535);
      expect(parseInteger("10000")).toBe(10000);
    });

    it("preserves invalid or non-integer numbers for Zod to reject", () => {
      expect(parseInteger("5000abc")).toBe("5000abc");
      expect(parseInteger("NaN")).toBe("NaN");
      expect(parseInteger("Infinity")).toBe("Infinity");
      expect(parseInteger("")).toBe("");
    });

    it("preserves floats for Zod to reject", () => {
      expect(parseInteger("5.5")).toBe(5.5);
    });
  });
});
