import { AppError } from "./app-error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";

export class UnsupportedContentEncodingError extends AppError {
  constructor() {
    super({
      message: "Compressed request bodies are not supported.",
      code: ERROR_CODES.UNSUPPORTED_CONTENT_ENCODING,
      statusCode: 415,
      isOperational: true,
    });
  }
}
