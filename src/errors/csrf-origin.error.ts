import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AppError } from "./app-error.js";

export class CsrfOriginError extends AppError {
  public constructor(cause?: unknown) {
    super({
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: ERROR_CODES.CSRF_ORIGIN_DENIED,
      message: "Request origin could not be verified.",
      cause,
    });
  }
}
