import { AppError } from "../../errors/app-error.js";
import { createErrorFingerprint } from "./create-error-fingerprint.js";

export type SafeSerializedError = {
  category: "application" | "unexpected";
  name: string;
  code: string;
  statusCode: number;
  fingerprint: string;
  operational: boolean;
};

export function safeErrorSerializer(error: unknown): SafeSerializedError {
  const fingerprint = createErrorFingerprint(error);

  const errRec =
    error !== null && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const isAppError = error instanceof AppError || errRec?.isAppError === true;

  if (isAppError) {
    const err = error as AppError;
    return {
      category: "application",
      name: err.name,
      code: err.code,
      statusCode: err.statusCode,
      fingerprint,
      operational: err.isOperational,
    };
  }

  return {
    category: "unexpected",
    name: "InternalError",
    code: "INTERNAL_SERVER_ERROR",
    statusCode: 500,
    fingerprint,
    operational: false,
  };
}
