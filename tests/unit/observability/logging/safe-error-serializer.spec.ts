import { jest } from "@jest/globals";
import { safeErrorSerializer } from "../../../../src/observability/logging/safe-error-serializer.js";
import { ConfigurationError } from "../../../../src/errors/configuration.error.js";

describe("Safe Error Serializer", () => {
  it("strips message, stack, and unknown properties", () => {
    const error = new Error("Super secret failure");
    error.stack = "fake stack trace";
    (error as any).password = "123456";

    const result = safeErrorSerializer(error);

    expect((result as any).message).toBeUndefined();
    expect((result as any).stack).toBeUndefined();
    expect((result as any).password).toBeUndefined();

    expect(result.name).toBe("Error");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });

  it("preserves safe category and status for structured errors", () => {
    const error = new ConfigurationError([{ variable: "test", message: "Bad config" }]);
    const result = safeErrorSerializer(error);

    expect(result.category).toBe("startup");
    expect(result.name).toBe("ConfigurationError");
  });

  it("handles non-error objects gracefully", () => {
    const obj = { msg: "Something went wrong" };
    const result = safeErrorSerializer(obj);

    expect(result.name).toBe("UnknownError");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });
});
