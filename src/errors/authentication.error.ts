import { AppError, type AppErrorOptions } from "./app-error.js";

export abstract class AuthenticationError extends AppError {
  public readonly challenge = "Bearer";

  protected constructor(options: AppErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
