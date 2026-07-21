import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AppError } from "./app-error.js";

export class RateLimitExceededError extends AppError {
  public constructor(cause?: unknown) {
    super({
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message: "Too many requests. Please try again later.",
      cause,
    });
  }
}
