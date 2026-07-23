# 04. Update Current User Profile API (Phase 3.4)

## Overview

This document specifies the implementation of the `PATCH /api/v1/users/me` endpoint. It provides authenticated users the ability to update their canonical profile.

## Architecture

The API operates in the following layers:

- **Router Layer** (`user-profile.router.ts`): Binds the `PATCH /api/v1/users/me` route to the corresponding controller. Uses the standard authentication middleware to extract user claims.
- **Controller Layer** (`user-profile.controller.ts`): Parses the request body using `UpdateUserProfileInputSchema`. Validates the payload and passes the structured input to the service. Wraps responses safely and explicitly injects the `Cache-Control: no-store` header.
- **Service Layer** (`user-profile.service.ts`): Manages error bubbling and maps specific database/persistence layer errors (like `OPERATION_FAILED` and `RECORD_NOT_FOUND`) to safe application layer errors (`ServiceUnavailableError`, `UserProfileNotFoundError`).
- **Repository Layer** (`user-profile.repository.ts`): Invokes the Supabase client under the context of the user token. Modifies the database via `update()`.

## Security & Normalization

1. **Isolation**: Users can only update their own profile. The target `userId` is strictly resolved from the JWT `sub` claim.
2. **RLS Integrity**: The endpoint invokes the `UserProfileRepository.updateOwnProfile` method utilizing the authenticated, user-scoped Supabase client.
3. **Data Sanitization**: Empty or whitespace-only strings are automatically normalized to `null`. Array inputs (like `preferredRoles`) are deduped and empty entries are pruned.
4. **HTTPS Enforcement**: `avatarUrl` is strictly enforced to use `https://` with a regex pattern `^https://` injected in the OpenAPI JSON schema and strict `zod` validations.
5. **No-Store Headers**: Response includes `Cache-Control: no-store` header to prevent intermediate proxies from caching sensitive profile updates, even for errors.

## RLS Limitation & Deferred Work

- **Status Separation (Deferred to P3.6)**: Due to how Row Level Security (RLS) policies are currently constructed, the application cannot distinguish between an account being explicitly deleted versus a suspended/inactive status when executing `updateOwnProfile()`. Thus, `UserProfileNotFoundError` safely masks these states into a standard 404 response. Proper separation and error types (e.g., `AccountDeletedError`) for the `PATCH` operation will be formally established when the RLS policies are evolved in P3.6.

## Error Mapping

| Scenario                                      | Persistence Error  | API Response (AppError)    | Status Code                |
| :-------------------------------------------- | :----------------- | :------------------------- | :------------------------- |
| Valid update on existing account              | N/A                | Success                    | `200 OK`                   |
| Attempting to update a hidden/deleted account | `RECORD_NOT_FOUND` | `UserProfileNotFoundError` | `404 Not Found`            |
| Provider failure / DB transient error         | `OPERATION_FAILED` | `ServiceUnavailableError`  | `503 Service Unavailable`  |
| Malformed body / Type mismatch / Validation   | N/A                | `ValidationError`          | `422 Unprocessable Entity` |

## Logging

- Logging includes robust structural metadata, tying the update action to a given request.
- Logs strictly avoid capturing passwords, secrets, tokens, or PII.

## Testing Evidence

A comprehensive E2E test suite (`tests/e2e/phase-3/update-current-user-profile.e2e.spec.ts`) covers:

1. `GET` confirmation after `PATCH` updates.
2. Normalization behaviors (empty strings, preferred roles deduplication).
3. Nullification of nullable fields.
4. Rejection of unknown properties.
5. Security headers isolation (e.g., verifying `x-user-id` header/payload spoofing attacks are rejected/ignored).
6. Exclusion of sensitive tokens/passwords in responses.
7. Presence of `no-store` headers for both success and validation failures.
8. Proper fail-closed `404` semantics for inactive/deleted accounts via backend RLS.

## File Inventory

- `src/features/users/user-profile.router.ts`
- `src/features/users/user-profile.controller.ts`
- `src/features/users/user-profile.service.ts`
- `src/features/users/user-profile.schemas.ts`
- `src/features/users/user-profile.normalizers.ts`
- `src/persistence/users/user-profile.repository.ts`
- `src/openapi/components/user-profile.components.ts`
- `tests/e2e/phase-3/update-current-user-profile.e2e.spec.ts`
- `docs/backend/phase-3/04-update-current-user-profile-api.md`

## Acceptance Criteria

- [x] Provides a `PATCH /api/v1/users/me` endpoint.
- [x] Properly sanitizes and normalizes partial inputs, rejecting invalid or unknown properties.
- [x] Restricts `avatarUrl` strictly to HTTPS format in schema and validation.
- [x] Evaluates `OPERATION_FAILED` as a proper `ServiceUnavailableError`.
- [x] Ensures proper security headers (`Cache-Control: no-store`) on all responses.
- [x] Validated via robust E2E test suite covering spoofing and nullification behaviors.
- [x] Accompanied by updated documentation covering architecture, mapping, and limitations.

## P3.5 Handoff

With the completion of P3.4, the platform can safely authenticate and manage a user's canonical profile properties via `GET` and `PATCH`. The backend is now staged to continue with further User Profile/Account management operations or to advance to P3.5 depending on authorization from stakeholders.
