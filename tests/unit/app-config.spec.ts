import { createApplicationConfig } from "../../src/config/app-config.js";
import { environmentSchema } from "../../src/config/environment-schema.js";

describe("Application Config", () => {
  const baseValidEnv = { FRONTEND_URL: "http://localhost:5173" };

  it("maps flat environment to structured configuration", () => {
    const validEnvironment = environmentSchema.parse(baseValidEnv);
    const config = createApplicationConfig(validEnvironment);

    expect(config.runtime.port).toBe(5000);
    expect(config.frontend.origin).toBe("http://localhost:5173");
    expect(config.supabase.configured).toBe(false);
    expect(config.ai.provider).toBe("gemini");
    expect(config.cookies.secure).toBe(false);
  });

  it("correctly sets environment flags", () => {
    const devEnv = environmentSchema.parse({ ...baseValidEnv, NODE_ENV: "development" });
    const devConfig = createApplicationConfig(devEnv);
    expect(devConfig.runtime.isDevelopment).toBe(true);
    expect(devConfig.runtime.isProduction).toBe(false);

    const prodEnv = environmentSchema.parse({
      ...baseValidEnv,
      NODE_ENV: "production",
      COOKIE_SECURE: "true",
    });
    const prodConfig = createApplicationConfig(prodEnv);
    expect(prodConfig.runtime.isProduction).toBe(true);
    expect(prodConfig.runtime.isDevelopment).toBe(false);
  });

  it("sets supabase to configured when credentials are complete", () => {
    const validEnvironment = environmentSchema.parse({
      ...baseValidEnv,
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "pk_test",
      SUPABASE_SERVICE_ROLE_KEY: "sr_test",
    });
    const config = createApplicationConfig(validEnvironment);
    expect(config.supabase.configured).toBe(true);
    if (config.supabase.configured) {
      expect(config.supabase.url).toBe("https://example.supabase.co");
      expect(config.supabase.publishableKey).toBe("pk_test");
      expect(config.supabase.serviceRoleKey).toBe("sr_test");
    }
  });

  it("maps optional AI keys correctly", () => {
    const validEnvironment = environmentSchema.parse({
      ...baseValidEnv,
      GEMINI_API_KEY: "gemini_secret",
    });
    const config = createApplicationConfig(validEnvironment);
    expect(config.ai.geminiApiKey).toBe("gemini_secret");
    expect(config.ai.openAiApiKey).toBeUndefined();
  });
});
