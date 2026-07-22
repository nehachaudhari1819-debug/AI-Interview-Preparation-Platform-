import { createSafeConfigSummary } from "../../src/config/config-summary.js";
import type { ApplicationConfig } from "../../src/config/app-config.js";

describe("Safe Config Summary", () => {
  it("includes safe operational settings and excludes secrets", () => {
    const config = {
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
        refreshCookieMaxAgeSeconds: 3600,
        emailConfirmationRedirectUrl: "http://localhost:5173/auth/callback",
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
          preflightMaxAgeSeconds: 600,
        },
        helmet: { enableHsts: false },
      },
      cookies: { secure: false, sameSite: "lax" },
      logging: { level: "info" },
      rateLimits: {
        ipv6Subnet: 56,
        globalApi: { enabled: true, windowMs: 900000, maxRequests: 100 },
        authCredentials: { enabled: true, windowMs: 900000, maxRequests: 5 },
        authSession: { enabled: true, windowMs: 900000, maxRequests: 10 },
      },
      requestBoundaries: {
        jsonBodyLimitBytes: 102400,
        maxUrlLength: 2048,
        maxQueryParameters: 50,
      },
      httpServer: {
        requestTimeoutMs: 30000,
        headersTimeoutMs: 60000,
        keepAliveTimeoutMs: 5000,
        maxHeadersCount: 100,
      },
    } as unknown as ApplicationConfig;

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
