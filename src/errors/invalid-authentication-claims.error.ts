import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class InvalidAuthenticationClaimsError extends AuthenticationError {
  constructor() {
    super({
      message: "Access token claims are invalid.",
      code: ERROR_CODES.INVALID_AUTHENTICATION_CLAIMS,
      statusCode: 401,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
