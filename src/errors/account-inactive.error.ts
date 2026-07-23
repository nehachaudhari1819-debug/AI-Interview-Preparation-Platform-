import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "./app-error.js";

export class AccountInactiveError extends AppError {
  public constructor(message = "Account is inactive, suspended, or pending deletion.") {
    super({
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: ERROR_CODES.ACCOUNT_INACTIVE,
      message,
    });
  }
}
