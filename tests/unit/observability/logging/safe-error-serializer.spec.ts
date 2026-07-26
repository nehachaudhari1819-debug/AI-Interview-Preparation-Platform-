import { jest } from "@jest/globals";
import { safeErrorSerializer } from "../../../../src/observability/logging/safe-error-serializer.js";
import { AppError } from "../../../../src/errors/app-error.js";

describe("Safe Error Serializer", () => {
  it("strips message, stack, and unknown properties", () => {
    const error = new Error("Super secret failure");
    error.stack = "fake stack trace";
    (error as any).password = "123456";

    const result = safeErrorSerializer(error);

    expect((result as any).message).toBeUndefined();
    expect((result as any).stack).toBeUndefined();
    expect((result as any).password).toBeUndefined();

    expect(result.name).toBe("InternalError");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });

  it("preserves safe category and status for structured errors", () => {
    const error = new AppError({ statusCode: 400, code: "TEST", message: "Test" });
    const result = safeErrorSerializer(error);

    expect(result.category).toBe("application");
    expect(result.name).toBe("AppError");
  });

  it("handles cross-realm AppError objects gracefully", () => {
    const error = {
      name: "AppError",
      code: "TEST_CROSS_REALM",
      statusCode: 400,
      isAppError: true,
      isOperational: true,
    };
    const result = safeErrorSerializer(error);

    expect(result.category).toBe("application");
    expect(result.name).toBe("AppError");
    expect(result.code).toBe("TEST_CROSS_REALM");
    expect(result.statusCode).toBe(400);
    expect(result.operational).toBe(true);
  });

  it("handles non-error objects gracefully", () => {
    const obj = { msg: "Something went wrong" };
    const result = safeErrorSerializer(obj);

    expect(result.name).toBe("InternalError");
    expect(result.category).toBe("unexpected");
    expect(result.fingerprint).toBeDefined();
  });
});
