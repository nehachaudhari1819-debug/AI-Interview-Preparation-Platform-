import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class RegistrationUnavailableError extends AppError {
  public constructor() {
    super({
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: ERROR_CODES.REGISTRATION_UNAVAILABLE,
      message: "Registration is temporarily unavailable.",
    });
  }
}
