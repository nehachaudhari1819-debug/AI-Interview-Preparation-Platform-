import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "./app-error.js";

export class ForbiddenError extends AppError {
  public constructor(message = "Forbidden access.") {
    super({
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: ERROR_CODES.FORBIDDEN_ACCESS,
      message,
    });
  }
}
