import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import type { ApiFieldError } from "../types/api-response.types.js";
import { AppError } from "./app-error.js";

export class ValidationError extends AppError {
  public constructor(message = "Request validation failed.", errors?: ApiFieldError[]) {
    super({
      statusCode: HTTP_STATUS.UNPROCESSABLE_ENTITY,
      code: ERROR_CODES.VALIDATION_ERROR,
      message,
      errors,
    });
  }
}
