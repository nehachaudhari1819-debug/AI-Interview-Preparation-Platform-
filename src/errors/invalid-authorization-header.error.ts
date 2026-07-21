import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class InvalidAuthorizationHeaderError extends AuthenticationError {
  constructor() {
    super({
      message: "Authorization header is invalid.",
      code: ERROR_CODES.INVALID_AUTHORIZATION_HEADER,
      statusCode: 401,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
