# Phase 2.5: Security Middleware Foundation

## Overview

This phase establishes a robust, configuration-driven Express middleware foundation tailored for the AI Interview Preparation Platform API.

## Core Principles

1. **Configuration-Driven:** All security settings (CORS, Rate Limiting, Proxy Hops) are read dynamically from the validated `ApplicationConfig` object rather than `process.env`.
2. **Deterministic Pipeline:** Security middlewares run in a strict, predefined order immediately after app initialization.
3. **Exact Matching:** CORS strictly compares origins using full string equality (`===`). Regex, wildcards, and partial matches are forbidden.
4. **Standardized Errors:** All security rejections result in a standardized JSON error envelope containing a request ID for observability.

## Middleware Pipeline

The middleware is registered in `src/app.ts` in the following strict order:

1. Express Application Settings (`app.disable("x-powered-by")`, `trust proxy`)
2. Helmet (CSP, HSTS, cross-origin resource policies)
3. Request ID (`requestIdMiddleware`)
4. Request Security Context (`requestSecurityContextMiddleware`)
5. CORS (`createCorsMiddleware`)
6. Rate Limiting (`createApiRateLimitMiddleware`)
7. Content-Type Guard (`createJsonContentTypeGuard`)
8. JSON Parser (`express.json`)
9. Cookie Parser (`cookieParserMiddleware`)
10. API Router (`/api/v1`)
11. Not Found & Error Handlers

- **Authentication Handlers**: `WWW-Authenticate: Bearer` challenge is now emitted by the Error Handler upon `AuthenticationError`.
- **CSRF Token Issue/Verify**: Implemented (Route-level only, reserved for authenticated state-mutating requests).

## Key Decisions

- **URL-Encoded Parser Removed:** Since the API exclusively consumes JSON, `express.urlencoded` has been entirely removed to minimize the attack surface.
- **CSRF Origin Guarding:** The `createCsrfOriginGuard` middleware validates `sec-fetch-site` and `origin` headers on unsafe methods (POST, PUT, DELETE, PATCH). It is deliberately **not** mounted globally so that programmatic clients (mobile apps, webhooks) aren't rejected. Instead, it is a route-level middleware reserved specifically for future cookie-backed authentication routes.
- **HSTS:** HSTS is dynamically enabled via Helmet only in the `production` environment.

## Validation & Testing

Comprehensive unit and integration tests have been written under `tests/unit/security` and `tests/security`. They verify the correct behavior of the middleware blocks, error handling, and proxy trust logic.
