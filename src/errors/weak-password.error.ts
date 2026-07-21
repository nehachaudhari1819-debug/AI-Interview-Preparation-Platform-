import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class WeakPasswordError extends AppError {
  public constructor() {
    super({
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: ERROR_CODES.WEAK_PASSWORD,
      message: "Password does not meet security requirements.",
    });
  }
}
