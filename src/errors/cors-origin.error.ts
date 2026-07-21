import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AppError } from "./app-error.js";

export class CorsOriginError extends AppError {
  public constructor(cause?: unknown) {
    super({
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: ERROR_CODES.CORS_ORIGIN_DENIED,
      message: "Request origin is not allowed.",
      cause,
    });
  }
}
