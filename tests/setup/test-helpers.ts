import type { ApplicationConfig } from "../../src/config/app-config.js";

export function createTestApplicationConfig(
  overrides?: Partial<ApplicationConfig>,
): Readonly<ApplicationConfig> {
  return {
    runtime: {
      nodeEnv: "test",
      isDevelopment: false,
      isTest: true,
      isProduction: false,
      port: 5000,
      shutdownTimeoutMs: 10000,
    },
    frontend: {
      origin: "http://localhost:5173",
    },
    authSession: {
      refreshCookieMaxAgeSeconds: 3600,
      emailConfirmationRedirectUrl: "http://localhost:5173/auth/callback",
    },
    supabase: {
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: "pk_test",
      privilegedKey: "sk_test",
      privilegedKeyType: "secret",
    },
    ai: {
      provider: "gemini",
    },
    storage: {
      resumeBucket: "resumes",
    },
    cookies: {
      secure: false,
      sameSite: "lax",
    },
    logging: {
      level: "silent",
    },
    security: {
      trustProxyHops: 0,
      cors: {
        allowedOrigins: Object.freeze(["http://localhost:5173"]),
        credentials: true,
        preflightMaxAgeSeconds: 600,
      },
      helmet: {
        enableHsts: false,
      },
    },
    rateLimits: {
      ipv6Subnet: 56,
      globalApi: { enabled: false, windowMs: 900000, maxRequests: 100 },
      authCredentials: { enabled: false, windowMs: 900000, maxRequests: 5 },
      authSession: { enabled: false, windowMs: 900000, maxRequests: 10 },
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
    ...overrides,
  };
}
