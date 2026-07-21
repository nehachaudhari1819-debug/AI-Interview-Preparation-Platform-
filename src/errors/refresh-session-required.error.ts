import { AuthenticationError } from "./authentication.error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class RefreshSessionRequiredError extends AuthenticationError {
  public constructor() {
    super({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: ERROR_CODES.REFRESH_SESSION_REQUIRED,
      message: "Refresh session is required.",
    });
  }
}
