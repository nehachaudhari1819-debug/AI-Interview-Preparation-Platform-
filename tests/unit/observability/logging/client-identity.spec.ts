import { jest } from "@jest/globals";
import { createClientIdentitySerializer } from "../../../../src/observability/logging/client-identity.js";

describe("Client Identity Serializer", () => {
  it("omits the IP when clientIpMode is omit", () => {
    const serialize = createClientIdentitySerializer("omit");
    const req = {
      ip: "192.168.1.1",
      headers: {
        "x-forwarded-for": "10.0.0.1",
        "user-agent": "jest-test",
      },
    };

    const result = serialize(req as any);

    expect(result.ip).toBeUndefined();
    expect(result.userAgent).toBe("jest-test");
    expect(JSON.stringify(result)).not.toContain("192.168.1.1");
    expect(JSON.stringify(result)).not.toContain("10.0.0.1");
  });

  it("hashes the IP when clientIpMode is hash", () => {
    const serialize = createClientIdentitySerializer("hash", "secret-key-123");
    const req = {
      ip: "192.168.1.1",
      headers: {
        "user-agent": "jest-test",
      },
    };

    const result = serialize(req as any);

    expect(result.ip).toBeUndefined();
    expect(result.clientId).toBeDefined();
    expect(result.clientId.length).toBeGreaterThan(10);
    expect(result.userAgent).toBe("jest-test");
    expect(JSON.stringify(result)).not.toContain("192.168.1.1");
  });
});
