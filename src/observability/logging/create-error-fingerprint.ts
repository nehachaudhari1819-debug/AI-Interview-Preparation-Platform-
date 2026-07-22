import { createHash } from "node:crypto";
import { AppError } from "../../errors/app-error.js";

export function createErrorFingerprint(error: unknown): string {
  let canonicalRepresentation = "unknown_error";

  if (error instanceof AppError) {
    canonicalRepresentation = `${error.name}:${error.code}:${error.statusCode}`;
  } else if (error instanceof Error) {
    const code = (error as any).code ? String((error as any).code) : "";
    const stack = error.stack ?? "";
    canonicalRepresentation = `${error.name}:${code}:${stack}`;
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
