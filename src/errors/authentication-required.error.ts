import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class AuthenticationRequiredError extends AuthenticationError {
  constructor() {
    super({
      message: "Authentication is required.",
      code: ERROR_CODES.AUTHENTICATION_REQUIRED,
      statusCode: 401,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
