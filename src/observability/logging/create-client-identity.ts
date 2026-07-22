import { createHmac } from "node:crypto";
import type { ApplicationConfig } from "../../config/app-config.js";

export function createClientIdentity(
  ipAddress: string | undefined,
  config: Readonly<ApplicationConfig>,
): string | undefined {
  if (config.observability.clientIpMode === "omit") {
    return undefined;
  }

  if (ipAddress === undefined) {
    return undefined;
  }

  const hashKey = config.observability.clientIpHashKey;
  if (!hashKey) {
    return undefined;
  }

  return createHmac("sha256", hashKey).update(ipAddress).digest("hex").slice(0, 16);
}
