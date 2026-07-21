import type { CookieOptions, Request, Response } from "express";
import type { ApplicationConfig } from "../../config/app-config.js";

export const PRODUCTION_REFRESH_COOKIE_NAME = "__Secure-aiip_refresh";
export const DEVELOPMENT_REFRESH_COOKIE_NAME = "aiip_refresh";
export const AUTH_COOKIE_PATH = "/api/v1/auth";

export function getRefreshCookieName(config: Readonly<ApplicationConfig>): string {
  return config.runtime.nodeEnv === "production"
    ? PRODUCTION_REFRESH_COOKIE_NAME
    : DEVELOPMENT_REFRESH_COOKIE_NAME;
}

export function createRefreshCookieOptions(config: Readonly<ApplicationConfig>): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: AUTH_COOKIE_PATH,
    maxAge: config.authSession.refreshCookieMaxAgeSeconds * 1000,
    priority: "high",
  };
}

export function setRefreshTokenCookie(
  response: Response,
  config: Readonly<ApplicationConfig>,
  refreshToken: string,
): void {
  const cookieName = getRefreshCookieName(config);
  const options = createRefreshCookieOptions(config);
  response.cookie(cookieName, refreshToken, options);
}

export function clearRefreshTokenCookie(
  response: Response,
  config: Readonly<ApplicationConfig>,
): void {
  const cookieName = getRefreshCookieName(config);
  const options = createRefreshCookieOptions(config);
  response.clearCookie(cookieName, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  });
}

export function readRefreshTokenCookie(
  request: Request,
  config: Readonly<ApplicationConfig>,
): string | undefined {
  const cookieName = getRefreshCookieName(config);
  const cookieValue = request.cookies[cookieName] as unknown;

  if (typeof cookieValue !== "string" || cookieValue.length === 0) {
    return undefined;
  }

  if (cookieValue.length > 16384) {
    return undefined; // Too large
  }

  // Reject control characters, CR, LF, internal whitespace
  // eslint-disable-next-line no-control-regex
  if (/[\s\x00-\x1F\x7F]/.test(cookieValue)) {
    return undefined;
  }

  return cookieValue;
}
