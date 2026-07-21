import { ERROR_CODES } from "../../src/constants/error-codes.constants.js";
import { AppError } from "../../src/errors/app-error.js";
import { InternalServerError } from "../../src/errors/internal-server.error.js";
import { NotFoundError } from "../../src/errors/not-found.error.js";
import { ValidationError } from "../../src/errors/validation.error.js";

describe("Application Errors", () => {
  describe("AppError", () => {
    it("preserves properties and sets prototype", () => {
      const error = new AppError({
        statusCode: 400,
        code: "TEST_CODE",
        message: "Test message",
      });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe("TEST_CODE");
      expect(error.message).toBe("Test message");
      expect(error.isOperational).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe("NotFoundError", () => {
    it("uses 404 and RESOURCE_NOT_FOUND", () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
      expect(error.message).toBe("Resource not found.");
    });
  });

  describe("ValidationError", () => {
    it("uses 422 and VALIDATION_ERROR with structured errors", () => {
      const fieldErrors = [{ field: "email", message: "Invalid email" }];
      const error = new ValidationError("Failed", fieldErrors);

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.errors).toBe(fieldErrors);
    });
  });

  describe("InternalServerError", () => {
    it("uses 500 and is not operational", () => {
      const cause = new Error("db failure");
      const error = new InternalServerError("Error", cause);

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
      expect(error.isOperational).toBe(false);
      expect(error.cause).toBe(cause);
    });
  });
});
