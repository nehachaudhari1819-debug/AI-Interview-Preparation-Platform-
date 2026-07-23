# Phase 3.3: Get Current User Profile API

## Title and Status

**Title:** Get Current User Profile API
**Status:** IMPLEMENTED

## Purpose

To provide a secure, authenticated endpoint (`GET /api/v1/users/me`) for users to retrieve their canonical profile data, while enforcing the active-account boundary and preserving strict isolation of persistence layers from the HTTP layer.

## Endpoint Details

- **Method:** `GET`
- **Path:** `/api/v1/users/me`
- **Authentication:** Required (Bearer Token)
- **Authorization:** Active Account Required

## Security Boundaries

### Authentication and Authorization

The endpoint relies on `createAuthenticationMiddleware` to ensure a valid session exists. Additionally, `UserProfileService.getCurrentUserProfile` explicitly checks that `accountStatus === 'active'` and `deletedAt === null`. If either condition is violated (and the row is visible), an `AccountDisabledError` (403) or `AccountDeletedError` (403) is thrown.

**Note on RLS (P3.6 Deferral):** During Phase 3.3, the RLS policies strictly hide suspended or deleted rows from the authenticated user. Therefore, an inactive account will currently return `404 USER_PROFILE_NOT_FOUND` instead of `403`. Exact inactive-status differentiation is deferred to Phase 3.6 where RLS updates are authorized.

### Response Data Sanitization

The endpoint returns a safe `UserProfileResponse` mapped via `mapUserProfileToResponse`. This explicitly omits internal domain fields such as `deletedAt` and serializes `Date` timestamps (`createdAt`, `updatedAt`) to ISO-8601 strings.

### Cache Prevention

The route applies the `authNoStoreMiddleware` to inject `Cache-Control: no-store` headers, ensuring sensitive profile data is never cached by intermediate proxies or the client browser.

## Error Behavior

- **Missing/Invalid Token:** `401 AUTHENTICATION_REQUIRED` or `401 INVALID_ACCESS_TOKEN`
- **Suspended Account:** `403 ACCOUNT_DISABLED` (when visible)
- **Deleted Account:** `403 ACCOUNT_DELETED` (when visible)
- **Profile Not Found:** `404 USER_PROFILE_NOT_FOUND` (including inactive accounts hidden by RLS until P3.6)
- **Provider Failure:** `503 SERVICE_UNAVAILABLE`

## Architecture and Integration

The implementation spans across the application layers:

- **Router:** `createUserProfileRouter` (registers the route and middlewares)
- **Controller:** `createGetMeController` (extracts the authenticated principal and maps the response)
- **Service:** `UserProfileService` (retrieves the canonical domain model from the repository and enforces active-account constraints)
- **Errors:** Safe error boundaries are maintained. No raw database exceptions escape to the HTTP layer.

## Verification and Testing

Targeted testing confirms that the logic correctly implements the API contract:

- **Unit Tests:** Service (handles account checks and provider errors), Controller (response mapping), and Router (dependencies wire-up).
- **Integration Tests:** API integrations explicitly verify mapping, provider mocking, and the 403 inactive account enforcement.
- **Security Tests:** Validates that suspended or pending-deletion accounts cannot be retrieved, and that `no-store` cache headers are applied.
- **E2E Tests:** Uses actual Supabase environments to verify end-to-end token validation, profile retrieval, and error mapping for missing/invalid tokens.

## P3.4 Handoff

The core retrieval endpoint is stable. The logical next phase (P3.4) will build upon the exact same security and error-handling paradigms to implement the update endpoint (`PATCH /api/v1/users/me`).
