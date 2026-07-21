import { AppError, type AppErrorOptions } from "./app-error.js";

export abstract class AuthApiError extends AppError {
  protected constructor(options: AppErrorOptions) {
    super(options);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
