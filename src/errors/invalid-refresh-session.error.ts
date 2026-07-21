import { AuthenticationError } from "./authentication.error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class InvalidRefreshSessionError extends AuthenticationError {
  public constructor() {
    super({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: ERROR_CODES.INVALID_REFRESH_SESSION,
      message: "Refresh session is invalid or expired.",
    });
  }
}
