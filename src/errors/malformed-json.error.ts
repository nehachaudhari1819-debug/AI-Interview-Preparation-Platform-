import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class MalformedJsonError extends AppError {
  constructor() {
    super({
      message: "Request body contains malformed JSON.",
      code: ERROR_CODES.MALFORMED_JSON,
      statusCode: 400,
      isOperational: true,
    });
  }
}
