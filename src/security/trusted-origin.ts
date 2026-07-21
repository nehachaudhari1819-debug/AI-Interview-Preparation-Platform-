import { ConfigurationError } from "../errors/configuration.error.js";

export function normalizeOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(`Invalid protocol ${parsed.protocol}`);
    }
    if (parsed.username !== "" || parsed.password !== "") {
      throw new Error("Embedded credentials are not allowed");
    }
    return parsed.origin;
  } catch (error: unknown) {
    throw new ConfigurationError("Invalid allowed origin configuration", [
      {
        path: ["allowedOrigin"],
        message: error instanceof Error ? error.message : "Malformed origin URL",
      },
    ]);
  }
}

export function isTrustedOrigin(candidate: string, allowedOrigins: readonly string[]): boolean {
  if (candidate === "null") {
    return false;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    if (parsed.username !== "" || parsed.password !== "") {
      return false;
    }
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}
