import { parseEnvironment, loadEnvironment } from "../../src/config/environment-loader.js";
import { ConfigurationError } from "../../src/errors/configuration.error.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

describe("Environment Loader", () => {
  const baseValidEnv = { FRONTEND_URL: "http://localhost:5173" };

  describe("parseEnvironment", () => {
    it("does not mutate the supplied object", () => {
      const source = { ...baseValidEnv, PORT: "3000" };
      const originalJson = JSON.stringify(source);
      parseEnvironment(source);
      expect(JSON.stringify(source)).toBe(originalJson);
    });

    it("throws ConfigurationError on invalid input with correct issue formatting", () => {
      try {
        parseEnvironment({ ...baseValidEnv, PORT: "invalid" });
        fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigurationError);
        const configError = error as ConfigurationError;
        expect(configError.issues.some((issue) => issue.variable === "PORT")).toBe(true);
      }
    });

    it("ensures error issues do not contain raw secret values", () => {
      try {
        parseEnvironment({
          ...baseValidEnv,
          SUPABASE_URL: "https://example.supabase.co",
          SUPABASE_PUBLISHABLE_KEY: "secret_value_123",
        });
        fail("Should have thrown");
      } catch (error) {
        const configError = error as ConfigurationError;
        const serialized = JSON.stringify(configError.issues);
        expect(serialized).not.toContain("secret_value_123");
      }
    });
  });

  describe("loadEnvironment", () => {
    let tempDir: string;
    let tempEnvFile: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "env-test-"));
      tempEnvFile = path.join(tempDir, ".env");
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("loads from injected source without reading file when told to", () => {
      const result = loadEnvironment({ source: baseValidEnv, loadEnvFile: false });
      expect(result.FRONTEND_URL).toBe(baseValidEnv.FRONTEND_URL);
    });

    it("handles missing .env file safely", () => {
      const result = loadEnvironment({
        source: baseValidEnv,
        loadEnvFile: true,
        envFilePath: path.join(tempDir, "nonexistent.env"),
      });
      expect(result.FRONTEND_URL).toBe(baseValidEnv.FRONTEND_URL);
    });

    it("gives existing environment values precedence over .env", () => {
      fs.writeFileSync(tempEnvFile, "FRONTEND_URL=http://file.com\nPORT=8000");
      const result = loadEnvironment({
        source: { ...baseValidEnv, PORT: "3000" },
        loadEnvFile: true,
        envFilePath: tempEnvFile,
      });

      expect(result.FRONTEND_URL).toBe(baseValidEnv.FRONTEND_URL);
      expect(result.PORT).toBe(3000);
    });
  });
});
