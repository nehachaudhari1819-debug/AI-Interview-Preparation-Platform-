import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class InvalidAccessTokenError extends AuthenticationError {
  constructor() {
    super({
      message: "Access token is invalid.",
      code: ERROR_CODES.INVALID_ACCESS_TOKEN,
      statusCode: 401,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
