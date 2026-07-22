import { jest } from "@jest/globals";
import { Writable } from "node:stream";
import { createApplicationLogger } from "../../../../src/observability/logging/application-logger.factory.js";
import { createTestApplicationConfig } from "../../setup/test-helpers.js";

describe("Application Logger", () => {
  it("respects the log level configuration", () => {
    let output = "";
    const stream = new Writable({
      write(chunk, enc, cb) {
        output += chunk.toString();
        cb();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "error",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "test",
        appVersion: "1.0",
        gitCommitSha: "abc",
        shutdownGracePeriodMs: 1000,
      },
    });

    const logger = createApplicationLogger({ config, destination: stream });

    logger.info("This info log should be suppressed");
    expect(output).toBe("");

    logger.error("This error log should appear");
    expect(output).toContain("This error log should appear");
  });

  it("includes base metadata in all logs", () => {
    let output = "";
    const stream = new Writable({
      write(chunk, enc, cb) {
        output += chunk.toString();
        cb();
      },
    });

    const config = createTestApplicationConfig({
      observability: {
        logLevel: "info",
        pretty: false,
        logHealthRequests: false,
        clientIpMode: "omit",
        serviceName: "test-service",
        appVersion: "1.2.3",
        gitCommitSha: "deadbeef",
        shutdownGracePeriodMs: 1000,
      },
    });

    const logger = createApplicationLogger({ config, destination: stream });
    logger.info("Test log");

    const parsed = JSON.parse(output);
    expect(parsed.service).toBe("test-service");
    expect(parsed.version).toBe("1.2.3");
    expect(parsed.commit).toBe("deadbeef");
  });
});
