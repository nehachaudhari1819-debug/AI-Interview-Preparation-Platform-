import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AppError } from "./app-error.js";

export class ServiceUnavailableError extends AppError {
  constructor() {
    super({
      statusCode: HTTP_STATUS.SERVICE_UNAVAILABLE,
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      message: "Service is temporarily unavailable.",
      isOperational: true,
    });
    this.name = "ServiceUnavailableError";
  }
}
