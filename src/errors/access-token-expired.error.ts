import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class AccessTokenExpiredError extends AuthenticationError {
  constructor() {
    super({
      message: "Access token has expired.",
      code: ERROR_CODES.ACCESS_TOKEN_EXPIRED,
      statusCode: 401,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
