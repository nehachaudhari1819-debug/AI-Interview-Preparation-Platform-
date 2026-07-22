import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class UriTooLongError extends AppError {
  constructor() {
    super({
      message: "Request target is too long.",
      code: ERROR_CODES.URI_TOO_LONG,
      statusCode: 414,
      isOperational: true,
    });
  }
}
