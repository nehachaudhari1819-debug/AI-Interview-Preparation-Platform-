import { jest } from "@jest/globals";
import { Writable } from "node:stream";
import { createApplicationLogger } from "../../src/observability/logging/application-logger.factory.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("logging-secret-redaction.security", () => {
  let logOutput: string[] = [];
  let logger: ReturnType<typeof createApplicationLogger>;

  beforeEach(() => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput.push(String(chunk));
        callback();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "info",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "test",
        appVersion: "1",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 5000,
      },
    });

    logger = createApplicationLogger({ config, destination: logStream });
  });

  const secrets = {
    password: "fake-password-secret",
    access_token: "fake-access-token",
    refresh_token: "fake-refresh-token",
    authorization: "fake-authorization-value",
    cookie: "fake-cookie-value",
    set_cookie: "fake-cookie-value",
    supabaseUrl: "fake-service-role-key",
    anonKey: "fake-anon-key",
    hashKey: "fake-client-ip-hash-key",
  };

  it("redacts direct bindings", () => {
    logger.info({ ...secrets }, "Test log");
    const out = logOutput.join("");
    Object.values(secrets).forEach((secret) => {
      expect(out).not.toContain(secret);
    });
  });

  it("redacts nested objects", () => {
    logger.info({ nested: { ...secrets, deeply: { password: secrets.password } } }, "Test log");
    const out = logOutput.join("");
    Object.values(secrets).forEach((secret) => {
      expect(out).not.toContain(secret);
    });
  });

  it("redacts request headers", () => {
    logger.info(
      {
        req: {
          headers: {
            authorization: secrets.authorization,
            cookie: secrets.cookie,
            "set-cookie": secrets.set_cookie,
          },
        },
      },
      "Test log",
    );
    const out = logOutput.join("");
    expect(out).not.toContain(secrets.authorization);
    expect(out).not.toContain(secrets.cookie);
    expect(out).not.toContain(secrets.set_cookie);
  });
});
