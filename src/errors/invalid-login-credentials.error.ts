import { AuthenticationError } from "./authentication.error.js";
import { ERROR_CODES } from "../constants/error-codes.constants.js";
import { HTTP_STATUS } from "../constants/http.constants.js";

export class InvalidLoginCredentialsError extends AuthenticationError {
  public override readonly challenge = "none";

  public constructor() {
    super({
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: ERROR_CODES.INVALID_LOGIN_CREDENTIALS,
      message: "Email or password is invalid.",
    });
  }
}
