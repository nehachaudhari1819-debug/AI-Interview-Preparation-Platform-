import { HTTP_STATUS } from "../constants/http.constants.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AppError } from "./app-error.js";

export class UnsupportedMediaTypeError extends AppError {
  public constructor(cause?: unknown) {
    super({
      statusCode: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
      code: ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
      message: "Request content type is not supported.",
      cause,
    });
  }
}
