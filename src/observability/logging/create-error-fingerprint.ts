import { createHash } from "node:crypto";
import { AppError } from "../../errors/app-error.js";

export function createErrorFingerprint(error: unknown): string {
  let canonicalRepresentation = "unknown_error";

  const errRec =
    error !== null && typeof error === "object" ? (error as Record<string, unknown>) : null;
  const isAppError = error instanceof AppError || errRec?.isAppError === true;

  if (isAppError) {
    const err = error as AppError;
    if (!err.isOperational && err.cause) {
      return createErrorFingerprint(err.cause);
    }
    canonicalRepresentation = `${err.name}:${err.code}:${String(err.statusCode)}`;
  } else if (error instanceof Error) {
    const errorRecord = error as unknown as Record<string, unknown>;
    const code =
      typeof errorRecord.code === "string"
        ? errorRecord.code
        : typeof errorRecord.code === "number"
          ? String(errorRecord.code)
          : "";
    let stackFrames = (error.stack ?? "").split("\n").slice(1);
    stackFrames = stackFrames.map((frame) => frame.replace(/:\d+:\d+/, "").trim()).slice(0, 10);
    canonicalRepresentation = `${error.name}:${code}:${stackFrames.join(",")}`;
  } else if (typeof error === "string") {
    canonicalRepresentation = `string_error:${error}`;
  } else {
    try {
      canonicalRepresentation = `object_error:${JSON.stringify(
        error,
        Object.getOwnPropertyNames(error),
      )}`;
    } catch {
      canonicalRepresentation = "unserializable_error";
    }
  }

  return createHash("sha256").update(canonicalRepresentation).digest("hex").slice(0, 16);
}
