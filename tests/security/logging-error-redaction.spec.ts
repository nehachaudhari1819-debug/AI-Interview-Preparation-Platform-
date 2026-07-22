import { jest } from "@jest/globals";
import { Writable } from "node:stream";
import { createApplicationLogger } from "../../src/observability/logging/create-application-logger.js";
import { createTestApplicationConfig } from "../setup/test-helpers.js";

describe("logging-error-redaction.security", () => {
  let logOutput: any[] = [];
  let logger: ReturnType<typeof createApplicationLogger>;

  beforeEach(() => {
    logOutput = [];
    const logStream = new Writable({
      write(chunk, encoding, callback) {
        logOutput.push(JSON.parse(String(chunk)));
        callback();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "info",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "ai-interview-preparation-platform-backend",
        appVersion: "1",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 5000,
      },
    });

    logger = createApplicationLogger({ config, destination: logStream });
  });

  it("redacts sensitive data from errors", () => {
    const error = new Error("Database connection failed for password=supersecret");
    error.stack =
      "Error: Database connection failed for password=supersecret\n    at someAccessToken=fake-access-token";
    (error as any).cause = { message: "Internal cause with refresh_token=fake-refresh-token" };
    (error as any).provider = { email: "user@example.com" };
    (error as any).cookie = "fake-cookie-value";

    logger.error({ err: error, event: "test.error" }, "Something went wrong");

    const errorLog = logOutput[0];

    expect(errorLog.error).toBeDefined();

    expect(errorLog.error.message).toBeUndefined();
    expect(errorLog.error.stack).toBeUndefined();
    expect(errorLog.error.cause).toBeUndefined();
    expect(errorLog.error.provider).toBeUndefined();
    expect(errorLog.error.cookie).toBeUndefined();

    const strLog = JSON.stringify(errorLog);
    expect(strLog).not.toContain("supersecret");
    expect(strLog).not.toContain("fake-access-token");
    expect(strLog).not.toContain("fake-refresh-token");
    expect(strLog).not.toContain("user@example.com");
    expect(strLog).not.toContain("fake-cookie-value");

    expect(errorLog.event).toBe("test.error");

    expect(errorLog.error.category).toBe("unexpected");
    expect(errorLog.error.fingerprint).toBeDefined();
  });
});
