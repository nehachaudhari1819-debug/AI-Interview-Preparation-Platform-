import { jest } from "@jest/globals";
import { createClientIdentity } from "../../../../src/observability/logging/create-client-identity.js";
import type { ApplicationConfig } from "../../../../src/config/app-config.js";

describe("Client Identity", () => {
  it("omits the IP when clientIpMode is omit", () => {
    const config = { observability: { clientIpMode: "omit" } } as ApplicationConfig;
    const result = createClientIdentity("192.168.1.1", config);
    expect(result).toBeUndefined();
  });

  it("hashes the IP when clientIpMode is hash", () => {
    const config = {
      observability: { clientIpMode: "hash", clientIpHashKey: "secret-key-123" },
    } as ApplicationConfig;
    const result = createClientIdentity("192.168.1.1", config);
    expect(result).toBeDefined();
    expect(result?.length).toBeGreaterThan(10);
  });
});
