# 07 - Authentication API & Session Lifecycle

## Status

Implemented

## Overview

This phase establishes the primary authentication gateway using Supabase Auth. It handles stateless access token delivery and stateful refresh token cookies (`HttpOnly`, `Secure`), along with comprehensive error normalization, rate limiting, and session rotation.

## Implementation Details

### Configuration

- `AUTH_REFRESH_COOKIE_MAX_AGE_SECONDS`: Configurable cookie lifetime.
- Split auth rate limits via environment config into distinct `AUTH_CREDENTIALS` and `AUTH_SESSION` policies.

### Errors

Normalized `AuthError` from Supabase to unified `AppError` variants:

- `InvalidAuthRequestError` (400)
- `WeakPasswordError` (400)
- `InvalidLoginCredentialsError` (401)
- `RefreshSessionRequiredError` (401)
- `InvalidRefreshSessionError` (401)
- `AuthenticationRateLimitExceededError` (429)
- `RegistrationUnavailableError` (503)
- `AuthenticationServiceUnavailableError` (503)

### Security Features

1. **Cookie Policies**: `HttpOnly`, `Secure` (production), specific `/api/v1/auth` path boundary.
2. **Rate Limiting**: Specifically targeted to the authentication endpoints to prevent brute-force attacks. Separate limiters for Credentials (login/register) and Session (refresh). Logout endpoint has no route-specific limiter.
3. **No-Store Middleware**: Prevents browser caching of authentication responses containing access tokens.
4. **Token Redaction**: Refresh tokens are never leaked into the public response bodies, only delivered via `Set-Cookie`.

### Endpoints

- `tests/unit/features/auth/auth.service.spec.ts`

> **Note**: As of P2.9, all authentication API requests are subject to strict structured logging redaction policies. No plain text passwords, `Authorization` tokens, or raw `Cookie` headers are logged, ensuring credentials cannot leak into log aggregators.
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
