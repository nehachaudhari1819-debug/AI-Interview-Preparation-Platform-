import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class PayloadTooLargeError extends AppError {
  constructor() {
    super({
      message: "Request payload is too large.",
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      statusCode: 413,
      isOperational: true,
    });
  }
}
