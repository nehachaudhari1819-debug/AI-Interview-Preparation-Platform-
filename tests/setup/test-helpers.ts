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
      cookieName: "sb-auth",
      cookieSecret: "test-secret",
      cookieDomain: "localhost",
      secure: false,
      sameSite: "lax",
    },
    supabase: {
      configured: false,
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
        allowedOrigins: ["http://localhost:5173"],
        credentials: true,
        preflightMaxAgeSeconds: 600,
      },
      rateLimit: {
        enabled: false,
        windowMs: 60000,
        maxRequests: 100,
      },
      helmet: {
        enableHsts: false,
      },
    },
    ...overrides,
  };
}
