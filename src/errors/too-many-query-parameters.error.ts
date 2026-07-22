import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class TooManyQueryParametersError extends AppError {
  constructor() {
    super({
      message: "Request contains too many query parameters.",
      code: ERROR_CODES.TOO_MANY_QUERY_PARAMETERS,
      statusCode: 400,
      isOperational: true,
    });
  }
}
