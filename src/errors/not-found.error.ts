import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";
import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  public constructor(message = "Resource not found.") {
    super({
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
      message,
    });
  }
}
