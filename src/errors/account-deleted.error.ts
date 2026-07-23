import { AppError } from "./app-error.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class AccountDeletedError extends AppError {
  public constructor() {
    super({
      message: "This account has been deleted.",
      code: ERROR_CODES.ACCOUNT_DELETED,
      statusCode: HTTP_STATUS.FORBIDDEN,
    });
  }
}
