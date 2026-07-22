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
5. Request Logging (`createRequestLoggingMiddleware`)
6. In-Flight Request Tracker (`createInFlightRequestMiddleware`)
7. Shutdown Admission Control (`createShutdownAdmissionMiddleware`)
8. Health Endpoints (`/health` Router)
9. CORS (`createCorsMiddleware`)
10. Rate Limiting (`createApiRateLimitMiddleware`)
11. Content-Type Guard (`createJsonContentTypeGuard`)
12. JSON Parser (`express.json`)
13. Cookie Parser (`cookieParserMiddleware`)
14. Request Boundaries (Method Guard, Target Guard)
15. API Router (`/api/v1`)
16. Not Found & Error Handlers

- **Authentication Handlers**: `WWW-Authenticate: Bearer` challenge is now emitted by the Error Handler upon `AuthenticationError`.
- **CSRF Token Issue/Verify**: Implemented (Route-level only, reserved for authenticated state-mutating requests).

## Key Decisions

- **URL-Encoded Parser Removed:** Since the API exclusively consumes JSON, `express.urlencoded` has been entirely removed to minimize the attack surface.
- **CSRF Origin Guarding:** The `createCsrfOriginGuard` middleware validates `sec-fetch-site` and `origin` headers on unsafe methods (POST, PUT, DELETE, PATCH). It is deliberately **not** mounted globally so that programmatic clients (mobile apps, webhooks) aren't rejected. Instead, it is a route-level middleware reserved specifically for future cookie-backed authentication routes.
- **HSTS:** HSTS is dynamically enabled via Helmet only in the `production` environment.
- **Request Boundaries:** Added protections for max JSON body size (default 100KB), max URL length (2048), max query parameters (50), and strict HTTP methods to block malicious payloads early.
- **Proxy Trust Bounded:** Explicit `trustProxyHops` configuration blocks infinite proxy spoofing, resolving vulnerabilities with X-Forwarded-For.
- **IPv6 Subnet Grouping:** Applies /56 subnet masking using `ipaddr.js` to prevent IPv6 rotating bypass attacks and IPv4-mapped address collapsing bugs.

## Validation & Testing

Comprehensive unit and integration tests have been written under `tests/unit/security` and `tests/security`. They verify the correct behavior of the middleware blocks, error handling, and proxy trust logic.
