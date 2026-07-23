import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "./app-error.js";

export class UserProfileNotFoundError extends AppError {
  public constructor(message = "User profile could not be found.") {
    super({
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: ERROR_CODES.USER_PROFILE_NOT_FOUND,
      message,
    });
  }
}
