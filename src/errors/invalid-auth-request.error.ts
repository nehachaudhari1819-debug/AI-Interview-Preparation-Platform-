import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import type { ApiFieldError } from "../types/api-response.types.js";

export class InvalidAuthRequestError extends AppError {
  public constructor(errors?: ApiFieldError[]) {
    super({
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.INVALID_AUTH_REQUEST,
      message: "Authentication request is invalid.",
      errors,
    });
  }
}
