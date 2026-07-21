import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "./app-error.js";

export class InternalServerError extends AppError {
  public constructor(message = "An unexpected error occurred.", cause?: unknown) {
    super({
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message,
      isOperational: false,
      cause,
    });
  }
}
