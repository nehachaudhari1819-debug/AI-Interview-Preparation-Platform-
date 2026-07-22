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

  if (error instanceof AppError) {
    return {
      category: "application",
      name: error.name,
      code: error.code,
      statusCode: error.statusCode,
      fingerprint,
      operational: true,
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
