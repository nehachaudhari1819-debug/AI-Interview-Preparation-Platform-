import type { ErrorCode } from "../constants/error-codes.constants.js";
import type { ApiFieldError } from "../types/api-response.types.js";

export type AppErrorOptions = {
  statusCode: number;
  code: ErrorCode | string;
  message: string;
  errors?: ApiFieldError[];
  isOperational?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode | string;
  public readonly errors?: ApiFieldError[];
  public readonly isOperational: boolean;

  public constructor(options: AppErrorOptions) {
    super(options.message, {
      cause: options.cause,
    });

    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.errors = options.errors;
    this.isOperational = options.isOperational ?? true;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
