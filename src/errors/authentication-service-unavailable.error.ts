import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { AuthenticationError } from "./authentication.error.js";

export class AuthenticationServiceUnavailableError extends AuthenticationError {
  constructor() {
    super({
      message: "Authentication service is temporarily unavailable.",
      code: ERROR_CODES.AUTHENTICATION_SERVICE_UNAVAILABLE,
      statusCode: 503,
    });
    // For 503, the challenge header isn't strictly necessary per HTTP spec because it's not a credential defect.
    // The requirement states "The 503 error may omit the Bearer challenge because it is not a credential defect. Implement the challenge behavior intentionally and document it."
    // We intentionally disable the challenge for service unavailable.
    // @ts-expect-error Intentionally overriding readonly to remove the challenge.
    this.challenge = undefined;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
