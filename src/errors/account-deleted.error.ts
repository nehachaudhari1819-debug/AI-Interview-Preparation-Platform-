import { BaseApplicationError } from "./base-application.error.js";
import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class AccountDeletedError extends BaseApplicationError {
  public constructor() {
    super("This account has been deleted.", ERROR_CODES.ACCOUNT_DELETED, HTTP_STATUS.FORBIDDEN);
  }
}
