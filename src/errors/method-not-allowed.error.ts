import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class MethodNotAllowedError extends AppError {
  constructor() {
    super({
      message: "HTTP method is not allowed.",
      code: ERROR_CODES.METHOD_NOT_ALLOWED,
      statusCode: 405,
      isOperational: true,
    });
  }
}
