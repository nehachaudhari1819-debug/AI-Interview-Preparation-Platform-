import { createSafeConfigSummary } from "../../src/config/config-summary.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("Safe Config Summary", () => {
  it("includes safe operational settings and excludes secrets", () => {
    const config: ApplicationConfig = {
      runtime: {
        nodeEnv: "development",
        isDevelopment: true,
        isTest: false,
        isProduction: false,
        port: 5000,
        shutdownTimeoutMs: 10000,
      },
      frontend: { origin: "http://localhost:5173" },
      authSession: {
        refreshCookieMaxAgeSeconds: 604800,
        rateLimit: { windowMs: 900000, maxRequests: 5 },
        emailConfirmationRedirectUrl: "http://localhost:3000/auth/callback",
      },
      supabase: {
        configured: true,
        url: "https://example.supabase.co",
        publishableKey: "pk_test_fake",
        privilegedKey: "sr_test_super_secret",
        privilegedKeyType: "secret",
      },
      ai: {
        provider: "gemini",
        geminiApiKey: "gemini_super_secret",
        openAiApiKey: "openai_super_secret",
      },
      storage: { resumeBucket: "resumes" },
      security: {
        trustProxyHops: 1,
        cors: {
          allowedOrigins: ["http://localhost:5173"],
          credentials: true,
          preflightMaxAgeSeconds: 86400,
        },
        rateLimit: { enabled: true, windowMs: 900000, maxRequests: 100 },
        helmet: { enableHsts: true },
      },
      cookies: { secure: false, sameSite: "lax" },
      logging: { level: "info" },
    };

    const summary = createSafeConfigSummary(config);

    expect(summary.nodeEnv).toBe("development");
    expect(summary.port).toBe(5000);
    expect(summary.supabaseConfigured).toBe(true);
    expect(summary.geminiConfigured).toBe(true);
    expect(summary.openAiConfigured).toBe(true);

    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain("pk_test_fake");
    expect(serialized).not.toContain("sr_test_super_secret");
    expect(serialized).not.toContain("gemini_super_secret");
    expect(serialized).not.toContain("openai_super_secret");
  });
});
