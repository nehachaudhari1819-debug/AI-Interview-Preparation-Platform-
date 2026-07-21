import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class AuthenticationRateLimitExceededError extends AppError {
  public constructor() {
    super({
      statusCode: HTTP_STATUS.TOO_MANY_REQUESTS,
      code: ERROR_CODES.AUTHENTICATION_RATE_LIMIT_EXCEEDED,
      message: "Too many authentication attempts. Please try again later.",
    });
  }
}
