import { jest } from "@jest/globals";
import { safeErrorSerializer } from "../../../../src/observability/logging/safe-error-serializer.js";
import { ConfigurationError } from "../../../../src/errors/configuration.error.js";

describe("Safe Error Serializer", () => {
  it("strips message, stack, and unknown properties", () => {
    const error = new Error("Super secret failure");
    error.stack = "fake stack trace";
    (error as any).password = "123456";
    
    const result = safeErrorSerializer(error);
    
    expect(result.message).toBeUndefined();
    expect(result.stack).toBeUndefined();
    expect((result as any).password).toBeUndefined();
    
    expect(result.type).toBe("Error");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });

  it("preserves safe category and status for structured errors", () => {
    const error = new ConfigurationError("Bad config");
    const result = safeErrorSerializer(error);
    
    expect(result.category).toBe("startup");
    expect(result.type).toBe("ConfigurationError");
  });

  it("handles non-error objects gracefully", () => {
    const obj = { msg: "Something went wrong" };
    const result = safeErrorSerializer(obj as any);
    
    expect(result.type).toBe("UnknownError");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });
});
