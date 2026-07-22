import { jest } from "@jest/globals";
import { startServer } from "../../src/server.js";
import { loadApplicationConfig } from "../../src/config/index.js";
import { ConfigurationError } from "../../src/errors/configuration.error.js";
import type { Server } from "node:http";
import type { Express } from "express";

describe("Environment Startup Integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("loads configuration successfully when valid", () => {
    process.env.FRONTEND_URL = "http://localhost:5173";
    const config = loadApplicationConfig({ loadEnvFile: false });

    expect(config.runtime.port).toBe(5000);
    expect(config.frontend.origin).toBe("http://localhost:5173");
  });

  it("throws ConfigurationError without leaking secrets on invalid configuration", () => {
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.PORT = "invalid";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "pk_fake";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sr_super_secret_fake";
    // We intentionally make SUPABASE partial to fail or PORT invalid to fail

    try {
      loadApplicationConfig({ loadEnvFile: false });
      fail("Should have thrown ConfigurationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);

      const configError = error as ConfigurationError;
      const hasPortIssue = configError.issues.some((i) => i.variable === "PORT");
      expect(hasPortIssue).toBe(true);

      const serialized = JSON.stringify(configError.issues);
      expect(serialized).not.toContain("sr_super_secret_fake");
      expect(serialized).not.toContain("pk_fake");
    }
  });

  it("server startup is allowed to proceed when configuration is valid", async () => {
    process.env.FRONTEND_URL = "http://localhost:5173";
    process.env.PORT = "8123";
    const config = loadApplicationConfig({ loadEnvFile: false });
    const mockApp = {} as unknown as Express;

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const server = startServer({
      // app: mockApp,
      port: 0, // Use ephemeral port to avoid EADDRINUSE conflicts
      shutdownTimeoutMs: 10,
      config,
    });

    expect(server).toBeDefined();

    await new Promise((resolve) => {
      server.on("listening", resolve);
    });

    expect(server.listening).toBe(true);

    await new Promise((resolve) => {
      server.close(resolve);
    });

    logSpy.mockRestore();
  });
});
