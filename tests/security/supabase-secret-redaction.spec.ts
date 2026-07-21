/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { normalizeSupabaseError } from "../../src/integrations/supabase/supabase-error-normalizer.js";
import { createUserSupabaseClient } from "../../src/integrations/supabase/create-user-supabase-client.js";
import { jest } from "@jest/globals";
import { requireSupabaseConfig } from "../../src/integrations/supabase/require-supabase-config.js";
import { createSafeConfigSummary } from "../../src/config/config-summary.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("Supabase Secret Redaction", () => {
  const FAKE_PUBLISHABLE = "fake-publishable-key-to-redact";
  const FAKE_SECRET = "fake-secret-key-to-redact";
  const FAKE_LEGACY = "fake-legacy-service-role-key-to-redact";
  const FAKE_USER_TOKEN = "fake-user-access-token-to-redact";

  const configSecret = {
    runtime: { nodeEnv: "development", port: 5000, shutdownTimeoutMs: 10000 },
    frontend: { origin: "http://localhost:5173" },
    ai: { provider: "gemini" },
    storage: { resumeBucket: "resumes" },
    cookies: { secure: false, sameSite: "lax" },
    logging: { level: "info" },
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: FAKE_PUBLISHABLE,
      privilegedKey: FAKE_SECRET,
      privilegedKeyType: "secret",
    },
  } as ApplicationConfig;

  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => undefined) as any;
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined) as any;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("normalizer redacts secrets from raw provider errors", () => {
    const rawError = new Error(`Connection failed using ${FAKE_SECRET} and ${FAKE_USER_TOKEN}`);
    const normalized = normalizeSupabaseError(rawError, { operation: "test" });

    const serialized = JSON.stringify(normalized);
    expect(serialized).not.toContain(FAKE_SECRET);
    expect(serialized).not.toContain(FAKE_USER_TOKEN);
    expect(normalized.message).not.toContain(FAKE_SECRET);
    expect(normalized.message).not.toContain(FAKE_USER_TOKEN);
  });

  it("safe config summary redacts keys", () => {
    const summary = createSafeConfigSummary(configSecret);
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain(FAKE_SECRET);
    expect(serialized).not.toContain(FAKE_PUBLISHABLE);
    expect(serialized).not.toContain(FAKE_LEGACY);
    expect(serialized).toContain("secret"); // The type string is fine
  });

  it("requireSupabaseConfig errors do not include key values", () => {
    const badConfig = { supabase: { configured: false } } as ApplicationConfig;
    try {
      requireSupabaseConfig(badConfig);
    } catch (e: unknown) {
      const serialized = JSON.stringify(e);
      expect(serialized).not.toContain(FAKE_SECRET);
      expect(serialized).not.toContain(FAKE_PUBLISHABLE);
    }
  });

  it("createUserSupabaseClient token validation errors do not leak token", () => {
    try {
      createUserSupabaseClient({
        config: configSecret,
        accessToken: ` ${FAKE_USER_TOKEN} \n`,
        dependencies: { createClient: jest.fn() as any },
      });
    } catch (e: unknown) {
      const serialized = JSON.stringify(e);
      expect(serialized).not.toContain(FAKE_USER_TOKEN);
      expect((e as Error).message).not.toContain(FAKE_USER_TOKEN);
    }
  });
});
