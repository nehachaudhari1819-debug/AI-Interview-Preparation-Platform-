import { jest } from "@jest/globals";
import type { Request, Response } from "express";
import {
  createRefreshCookieOptions,
  getRefreshCookieName,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  PRODUCTION_REFRESH_COOKIE_NAME,
  DEVELOPMENT_REFRESH_COOKIE_NAME,
} from "../../../src/features/auth/auth-cookie.js";
import type { ApplicationConfig } from "../../../src/config/app-config.js";
import type { ValidatedEnvironment } from "../../../src/config/environment-schema.js";

function createMockConfig(env: Partial<ValidatedEnvironment>): Readonly<ApplicationConfig> {
  return {
    runtime: {
      nodeEnv: env.NODE_ENV || "development",
      isDevelopment: env.NODE_ENV === "development",
      isTest: env.NODE_ENV === "test",
      isProduction: env.NODE_ENV === "production",
      port: 5000,
      shutdownTimeoutMs: 10000,
    },
    frontend: {
      origin: "http://localhost:5173",
    },
    supabase: { configured: false },
    ai: { provider: "gemini" },
    storage: { resumeBucket: "test" },
    cookies: {
      secure: env.COOKIE_SECURE ?? false,
      sameSite: env.COOKIE_SAME_SITE ?? "lax",
    },
    logging: { level: "info" },
    security: {
      trustProxyHops: 0,
      cors: { allowedOrigins: [], credentials: true, preflightMaxAgeSeconds: 600 },
      rateLimit: { enabled: true, windowMs: 60000, maxRequests: 100 },
      helmet: { enableHsts: false },
    },
    authSession: {
      refreshCookieMaxAgeSeconds: 3600,
      rateLimit: { windowMs: 60000, maxRequests: 10 },
      emailConfirmationRedirectUrl: "http://localhost:5173/auth/callback",
    },
  };
}

describe("Auth Cookie Utilities", () => {
  describe("getRefreshCookieName", () => {
    it("returns production name when nodeEnv is production", () => {
      const config = createMockConfig({ NODE_ENV: "production" });
      expect(getRefreshCookieName(config)).toBe(PRODUCTION_REFRESH_COOKIE_NAME);
    });

    it("returns development name when nodeEnv is development", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      expect(getRefreshCookieName(config)).toBe(DEVELOPMENT_REFRESH_COOKIE_NAME);
    });
  });

  describe("createRefreshCookieOptions", () => {
    it("uses config values", () => {
      const config = createMockConfig({
        COOKIE_SECURE: true,
        COOKIE_SAME_SITE: "none",
      });
      const options = createRefreshCookieOptions(config);
      expect(options).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/api/v1/auth",
        maxAge: 3600000,
        priority: "high",
      });
    });
  });

  describe("setRefreshTokenCookie", () => {
    it("calls response.cookie with correct parameters", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      const response = {
        cookie: jest.fn(),
      } as unknown as Response;

      setRefreshTokenCookie(response, config, "test-token");
      expect(response.cookie).toHaveBeenCalledWith(
        DEVELOPMENT_REFRESH_COOKIE_NAME,
        "test-token",
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe("clearRefreshTokenCookie", () => {
    it("calls response.clearCookie with correct parameters", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      const response = {
        clearCookie: jest.fn(),
      } as unknown as Response;

      clearRefreshTokenCookie(response, config);
      expect(response.clearCookie).toHaveBeenCalledWith(
        DEVELOPMENT_REFRESH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true }),
      );
    });
  });

  describe("readRefreshTokenCookie", () => {
    it("returns the token if present and valid", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      const request = {
        cookies: {
          [DEVELOPMENT_REFRESH_COOKIE_NAME]: "valid-token",
        },
      } as unknown as Request;

      expect(readRefreshTokenCookie(request, config)).toBe("valid-token");
    });

    it("returns undefined if token is missing", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      const request = {
        cookies: {},
      } as unknown as Request;

      expect(readRefreshTokenCookie(request, config)).toBeUndefined();
    });

    it("returns undefined if token contains invalid characters", () => {
      const config = createMockConfig({ NODE_ENV: "development" });
      const request = {
        cookies: {
          [DEVELOPMENT_REFRESH_COOKIE_NAME]: "invalid token \n",
        },
      } as unknown as Request;

      expect(readRefreshTokenCookie(request, config)).toBeUndefined();
    });
  });
});
