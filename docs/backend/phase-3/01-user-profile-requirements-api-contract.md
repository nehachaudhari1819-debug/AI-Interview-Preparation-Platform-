# 1. Title and status

**Title:** Phase 3 User Profile Requirements and API Contract
**Status:** PROPOSED (P3.1)

# 2. Purpose

This document defines the complete backend contract for user-profile and account-management APIs before implementation begins in Phase 3. It establishes the exact data model, validation rules, endpoint semantics, security boundaries, and authorization requirements for reading, updating, and deactivating user profiles.

# 3. Approved baseline

**Authorized branch:** `backend`
**Authorized baseline commit:** `90292b4` (Phase 2 CI Success)

All specifications in this document assume the project's existing Phase 2 authentication and authorization middleware, global error handling, and database conventions remain unchanged.

# 4. Scope

This contract covers the specification of:

- The exact user-profile fields exposed to the API.
- Safe read access to the authenticated user's profile (`GET /api/v1/users/me`).
- Partial updates to allowed profile fields (`PATCH /api/v1/users/me`).
- Account deactivation and soft-deletion behavior (`DELETE /api/v1/users/me`).
- Necessary authorization, validation, error handling, audit, and idempotency constraints for these operations.

# 5. Non-goals

This phase (P3.1) and subsequent Phase 3 implementation will **not** implement:

- Public profiles or profile search.
- Administrative user-management endpoints (`GET /users/:id`, `PATCH /users/:id`).
- Email address changes.
- Password changes.
- Avatar file uploads to cloud storage.
- Production deployment or frontend implementations.
- Interview, question bank, resume, or AI functionalities.
- New database migrations during the documentation phase (P3.1).

# 6. Existing system context

This contract aligns with the established Phase 1 and Phase 2 architectures:

- Authentication is governed by Supabase Auth with stateless access tokens and secure refresh token cookies.
- Row Level Security (RLS) policies are active on the database, limiting access.
- Generated OpenAPI definitions and typed API responses represent the contract boundaries.

# 7. User-profile data contract

The API exposes the following fields representing the `public.users` database table. The public JSON responses transform the database `snake_case` fields to `camelCase`.

| Database Field     | API Field         |
| :----------------- | :---------------- |
| `id`               | `id`              |
| `email`            | `email`           |
| `full_name`        | `fullName`        |
| `college`          | `college`         |
| `branch`           | `branch`          |
| `graduation_year`  | `graduationYear`  |
| `experience_level` | `experienceLevel` |
| `preferred_roles`  | `preferredRoles`  |
| `bio`              | `bio`             |
| `avatar_url`       | `avatarUrl`       |
| `role`             | `role`            |
| `account_status`   | `accountStatus`   |
| `created_at`       | `createdAt`       |
| `updated_at`       | `updatedAt`       |
| `deleted_at`       | `deletedAt`       |

# 8. Field-level access matrix

| Field             | Returned to current user | User editable | System controlled | Security sensitive | Nullable | Notes                                                          |
| :---------------- | :----------------------- | :------------ | :---------------- | :----------------- | :------- | :------------------------------------------------------------- |
| `id`              | Yes                      | No            | Yes               | Yes                | No       | UUID                                                           |
| `email`           | Yes                      | No in Phase 3 | Yes               | Yes                | No       | Cannot be modified via profile update                          |
| `fullName`        | Yes                      | Yes           | No                | No                 | No       |                                                                |
| `college`         | Yes                      | Yes           | No                | No                 | Yes      |                                                                |
| `branch`          | Yes                      | Yes           | No                | No                 | Yes      |                                                                |
| `graduationYear`  | Yes                      | Yes           | No                | No                 | Yes      | Integer only                                                   |
| `experienceLevel` | Yes                      | Yes           | No                | No                 | Yes      | Enum constrained                                               |
| `preferredRoles`  | Yes                      | Yes           | No                | No                 | No       | Array of strings                                               |
| `bio`             | Yes                      | Yes           | No                | No                 | Yes      |                                                                |
| `avatarUrl`       | Yes                      | Yes           | No                | No                 | Yes      | Must be a valid URL if provided                                |
| `role`            | Yes                      | No            | Yes               | Yes                | No       | Immutable by user                                              |
| `accountStatus`   | Yes                      | No            | Yes               | Yes                | No       | Controlled by lifecycle events                                 |
| `createdAt`       | Yes                      | No            | Yes               | No                 | No       |                                                                |
| `updatedAt`       | Yes                      | No            | Yes               | No                 | No       | Automatically updated                                          |
| `deletedAt`       | No                       | No            | Yes               | Yes                | Yes      | Kept internal to prevent leaking soft-delete status explicitly |

# 9. API endpoint summary

Phase 3 defines exactly three endpoints:

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `DELETE /api/v1/users/me`

# 10. GET /api/v1/users/me contract

**Authentication:** Bearer access token required.
**Purpose:** Return the authenticated user's own safe profile.
**Success status:** `200 OK`

**Required success behavior:**

- Resolve the authenticated principal from approved authentication middleware.
- Read only the current user's profile based on the JWT `sub` claim.
- Never accept a user ID from query, path, or request body.
- Return only approved safe fields. `deletedAt` is excluded.
- Apply `Cache-Control: no-store` behavior.
- Preserve request ID behavior for tracing.
- Never expose raw Supabase provider objects or internal database structs.

**Required failure scenarios:**

- **Missing bearer token:** `401 Unauthorized` (`AUTHENTICATION_REQUIRED`)
- **Malformed authorization header:** `401 Unauthorized` (`INVALID_AUTHORIZATION_HEADER`)
- **Invalid access token:** `401 Unauthorized` (`INVALID_ACCESS_TOKEN`)
- **Expired access token:** `401 Unauthorized` (`ACCESS_TOKEN_EXPIRED`)
- **Profile not found:** `404 Not Found` (`USER_PROFILE_NOT_FOUND`)
- **Account disabled:** `403 Forbidden` (`ACCOUNT_DISABLED`)
- **Account deleted:** `403 Forbidden` (`ACCOUNT_DELETED`)
- **Persistence unavailable:** `503 Service Unavailable` (`SERVICE_UNAVAILABLE`)
- **Unexpected internal error:** `500 Internal Server Error` (`INTERNAL_SERVER_ERROR`)

# 11. GET response example

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "00000000-0000-4000-8000-000000000001",
      "email": "student@example.test",
      "fullName": "Example Student",
      "college": "Example Institute of Technology",
      "branch": "Electronics and Telecommunication",
      "graduationYear": 2027,
      "experienceLevel": "fresher",
      "preferredRoles": ["backend-developer", "embedded-engineer"],
      "bio": "Engineering student preparing for technical interviews.",
      "avatarUrl": null,
      "role": "student",
      "accountStatus": "active",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "meta": {
    "requestId": "00000000-0000-4000-8000-000000000002"
  }
}
```

# 12. PATCH /api/v1/users/me contract

**Authentication:** Bearer access token required.
**Purpose:** Allow the authenticated user to partially update approved profile fields.
**Content type:** `application/json`
**Success status:** `200 OK` (returning the updated safe profile).

**Allowed fields:**

- `fullName`
- `college`
- `branch`
- `graduationYear`
- `experienceLevel`
- `preferredRoles`
- `bio`
- `avatarUrl`

**Protected fields:**

- `id`
- `email`
- `role`
- `accountStatus`
- `createdAt`
- `updatedAt`
- `deletedAt`

**Security contract:**
The API must **reject** unknown and protected fields with a `422 Unprocessable Entity` schema validation error (`VALIDATION_ERROR`). Stripping protected fields silently is not permitted as it hides potential client issues or malicious intent.

# 13. PATCH semantic rules

- **Partial Updates:** Supported. Clients may send only the fields they intend to change.
- **Minimum Requirement:** At least one editable field must be present. Empty JSON objects are rejected.
- **Unknown/Protected Keys:** Rejected explicitly (HTTP 422 `VALIDATION_ERROR`).
- **Null Handling:** Allowed fields marked as nullable can be explicitly set to `null` to clear the value. `preferredRoles` sent as `null` is automatically normalized to an empty array `[]`.
- **Trimming:** String fields must be trimmed of leading and trailing whitespace. Empty strings (after trimming) are deterministically normalized to `null` for optional/nullable fields. If the field is required (`fullName`), an empty string is rejected with `VALIDATION_ERROR`.
- **Preferred Roles:** Duplicates must be automatically deduplicated.
- **Ownership:** Updates are strictly scoped to the authenticated user's ID.
- **System Fields:** `updated_at` must be controlled by the database trigger or data access layer, not the client.
- **Response:** The endpoint returns the normalized, fully updated profile object. No raw database rows are returned directly.
- **Lost-update protection:** Explicit optimistic locking (e.g., via `If-Match` ETags) is deferred for Phase 3. Concurrent updates will apply the last-write-wins policy safely scoped by the user ID.

# 14. Validation rules

| Field             | Validation Constraints                                                                                                                                      |
| :---------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fullName`        | Required. Min length: 1. Max length: 100. Trimmed. Cannot be empty string. Unicode supported.                                                               |
| `college`         | Optional/Nullable. Max length: 150. Trimmed.                                                                                                                |
| `branch`          | Optional/Nullable. Max length: 100. Trimmed.                                                                                                                |
| `graduationYear`  | Optional/Nullable. Integer only. Min: 2000. Max: 2100. Past years are valid. Null clears value.                                                             |
| `experienceLevel` | Optional/Nullable. Must match enum: `["fresher", "beginner", "intermediate", "advanced"]`.                                                                  |
| `preferredRoles`  | Optional. Array of strings. Max items: 10. Max length per item: 50. Empty array clears. Deduplicated.                                                       |
| `bio`             | Optional/Nullable. Max length: 500. Trimmed. Newlines allowed. HTML/Scripts treated as plain text (frontend must sanitize on render, backend stores as-is). |
| `avatarUrl`       | Optional/Nullable. Must be a valid URL. Max length: 2048. Allowed schemes: `https` only. Data and JavaScript URLs rejected.                                 |

# 15. DELETE /api/v1/users/me contract

**Authentication:** Bearer access token required.
**Purpose:** Allow the authenticated user to deactivate or request deletion of their own account.

**Phase 3 behavior (Soft-delete/Deactivation):**

- Soft-delete or deactivate the public profile.
- Set `account_status` to `deleted`.
- Set `deleted_at` to the current timestamp.
- Revoke active sessions (using Supabase admin client or session invalidation).
- Record an immutable audit event for account deactivation.
- Prevent continued protected access for the user.
- Preserve records needed for audit and integrity.
- Avoid immediate hard deletion of auth identities and relational data.

# 16. DELETE response and idempotency

**Success status:** `200 OK` (with a confirmation envelope).

**Idempotency Requirements:**

- The request must include an `Idempotency-Key` header.
- Repeated requests with the same key and same authenticated user return the original safe result (`200 OK`) without executing a duplicate deactivation flow.
- To permit idempotent replays after the account becomes inactive, the idempotency middleware must run **after** token verification but **before** the account-status authorization check (which would normally block deleted users).
- Reusing an idempotency key with conflicting operation data returns a `409 Conflict` (`IDEMPOTENCY_CONFLICT`).
- Maximum length of Idempotency-Key: 255 characters. Format: UUID preferred but string accepted.
- If the account is already deactivated/deleted and an idempotency key matches, return success. If the key is new or missing for an already deleted account, return `403 Forbidden` (`ACCOUNT_DELETED`).
- Do not expose stored request or provider details in idempotency records.

# 17. Account deletion limitations

Phase 3 implements soft deletion. Full cascading hard deletion of domain records (e.g., Interviews, Resumes) is deferred as those entities do not yet exist. Future tables must implement foreign key relationships that reference soft-deleted users without violating integrity (e.g., `ON DELETE RESTRICT` or maintaining the soft-deleted user row).

# 18. Authentication and authorization requirements

- All three endpoints (`GET`, `PATCH`, `DELETE` on `/users/me`) require the existing bearer-token middleware.
- The user ID must come from trusted JWT token claims only (`req.user.id`). Request-provided IDs are never trusted.
- Active-user checks must use approved persistence and RLS behavior.
- Anonymous users are denied (`401 Unauthorized`).
- Disabled/Deleted accounts are denied (`403 Forbidden`) according to the approved policy.
- Cross-user access is structurally impossible through the `/users/me` route.
- Service-role access remains server-side only. No role-based admin behavior is exposed.

# 19. RLS and database expectations

Required database behavior (No RLS changes required during P3.1):

- Authenticated users may `SELECT` only their own row.
- Authenticated users may `UPDATE` only their own row.
- `email`, `role`, `account_status`, `created_at`, `deleted_at` are effectively immutable via RLS or persistence layer mapping during standard profile updates.
- Anonymous access remains denied.
- Account deactivation (`DELETE` endpoint) utilizes a privileged backend workflow (service role) to update protected fields (`account_status`, `deleted_at`) and perform session revocation, bypassing the restrictive user RLS policy for this specific authorized action.
- Audit logs and Idempotency records remain append-only and system-controlled.

# 20. Error model

Standardized error envelopes will be returned.

| Condition               | HTTP Status | Stable Code                    | Safe Message                         | Retryable | Log Level |
| :---------------------- | :---------- | :----------------------------- | :----------------------------------- | :-------- | :-------- |
| Missing auth            | 401         | `AUTHENTICATION_REQUIRED`      | Authentication is required.          | No        | Warn/Info |
| Malformed auth header   | 401         | `INVALID_AUTHORIZATION_HEADER` | Invalid authorization header format. | No        | Warn      |
| Invalid token           | 401         | `INVALID_ACCESS_TOKEN`         | Access token is invalid.             | No        | Warn      |
| Expired token           | 401         | `ACCESS_TOKEN_EXPIRED`         | Access token has expired.            | Yes       | Info      |
| Profile not found       | 404         | `USER_PROFILE_NOT_FOUND`       | User profile could not be found.     | No        | Error     |
| Invalid update schema   | 422         | `VALIDATION_ERROR`             | Profile update data is invalid.      | No        | Warn      |
| Account disabled        | 403         | `ACCOUNT_DISABLED`             | This account has been disabled.      | No        | Info      |
| Account deleted         | 403         | `ACCOUNT_DELETED`              | This account has been deleted.       | No        | Info      |
| Missing idempotency key | 400         | `IDEMPOTENCY_KEY_REQUIRED`     | Idempotency-Key header is required.  | No        | Warn      |
| Idempotency conflict    | 409         | `IDEMPOTENCY_CONFLICT`         | Idempotency key conflict.            | No        | Warn      |
| Database unavailable    | 503         | `SERVICE_UNAVAILABLE`          | Service is temporarily unavailable.  | Yes       | Error     |
| Unexpected error        | 500         | `INTERNAL_SERVER_ERROR`        | An unexpected error occurred.        | No        | Error     |

_Sensitive information (e.g., raw database errors) must never appear in the safe message._

# 21. Security and privacy requirements

- Profile responses use `Cache-Control: no-store` to prevent caching of sensitive user data by shared intermediaries.
- Refresh tokens and Supabase session objects are never returned by the Profile API.
- Browser storage of access tokens remains governed by Phase 2 design.

# 22. Audit requirements

**Profile Read (`GET`):**

- No immutable database audit entry required. Structured request logs apply.

**Profile Update (`PATCH`):**

- Audit entry required.
- Record: Actor ID, Target User ID, Action (`PROFILE_UPDATED`), Request ID, Safe changed-field names (e.g., `["fullName", "bio"]`).
- Do NOT record: Full old/new values, tokens, cookies, or raw request headers.

**Account Deactivation (`DELETE`):**

- Audit entry required.
- Record: Action (`ACCOUNT_DEACTIVATED`), Lifecycle result, Idempotency context safely.
- Do NOT record: Passwords, tokens, cookies, or raw headers.

**Protected-field escalation attempts:**

- Should be logged at the security/warn level.

# 23. Logging and observability requirements

**Required safe log fields:**

- `event`
- `requestId`
- `method`
- `route`
- `statusCode`
- `durationMs`
- Authenticated user identifier (`userId`)
- Safe error code
- `outcome`

**Prohibited log data:**

- `Authorization` header, Access/Refresh tokens, Cookie values.
- Service-role key, Anon key, Passwords.
- Complete request bodies containing PII (e.g., full bio).
- Raw Supabase errors, SQL statements, Database URLs.

# 24. Rate limiting requirements

- `GET /users/me` utilizes global authenticated API limits.
- `PATCH /users/me` utilizes global limits.
- `DELETE /users/me` utilizes strict anti-abuse rate limiting to prevent spamming deletion workflows.
- Rate-limit keys must use user identifiers or IP addresses, never access tokens.
- No new rate-limiting implementation is required strictly in P3.1; existing global middleware suffices.

# 25. OpenAPI requirements (For P3.9)

Every endpoint must document:

- Summary & Description
- Tags (`Users`, `Profile`)
- Authentication (`bearerAuth`)
- Request and Response schemas (referencing shared components)
- Exhaustive Error responses
- Example payloads
- Explicit mention of `Cache-Control: no-store` behavior and `Idempotency-Key` headers where applicable.

# 26. Frontend integration notes

**Session Restoration:**

- Restore auth through the Phase 2 flow before fetching `/users/me`.

**Profile Screen:**

- Display safe fields; keep protected fields (`email`) read-only visually.
- Send only modified editable fields in `PATCH`.
- Display safe validation messages gracefully.

**Account Deletion:**

- Require explicit UI confirmation.
- Inject `Idempotency-Key`.
- Clear local authenticated state immediately upon success and redirect to sign-out.
- Do not automatically retry a failed deletion with a newly generated key.

# 27. Testing strategy

**Unit Tests:**

- Profile request schemas, field normalization, response mappers.

**Integration Tests:**

- Repository owner-scoped read, safe updates, error normalization, audit write integration, idempotency logic.

**Security Tests:**

- Anon access denied, cross-user isolation, protected fields rejected (`email`, `role`, `deletedAt`), logging redaction.

**E2E Tests:**

- Real Supabase flows: Read own profile, update allowed fields, reject protected fields, deactivation flow, session revocation, idempotency handling.

**pgTAP & OpenAPI Tests:**

- Ownership assertions on `users` table, schema freshness, route coverage.

# 28. Implementation boundaries for P3.2–P3.10

- **P3.1:** Requirements and API contract (this document).
- **P3.2:** Domain types, schemas, and repository foundation.
- **P3.3:** `GET /api/v1/users/me`
- **P3.4:** `PATCH /api/v1/users/me`
- **P3.5:** `DELETE /api/v1/users/me` and account lifecycle.
- **P3.6:** Authorization and RLS integration.
- **P3.7:** Audit and idempotency integration.
- **P3.8:** Validation and error hardening.
- **P3.9:** OpenAPI and frontend handoff.
- **P3.10:** Full testing, CI, and formal Phase 3 approval.

# 29. Known limitations

- Immediate hard deletion is not supported; accounts are soft-deleted via `account_status` and `deleted_at`.
- Email modification is out of scope for Phase 3 and requires a distinct verified workflow in the future.

# 30. Deferred work

- Avatars rely on external URLs; direct file uploads to storage buckets are deferred.
- Optimistic locking (`If-Match`) for concurrent profile updates is deferred.
- Cascading deletion rules for future domain entities (Interviews, Resumes).

# 31. Acceptance criteria

- [x] P3.1 document is complete and precise.
- [x] Represents real database schemas without inventing unauthorized columns.
- [x] Editable vs protected fields are clearly defined.
- [x] Endpoints (`GET`, `PATCH`, `DELETE`) are fully specified.
- [x] Validation, Error codes, Authentication, RLS, Audit, and Idempotency are defined.
- [x] Testing requirements and subphase boundaries are established.
- [x] No production code added in P3.1.

# 32. Approval checkpoint

Stop here. No further implementation (P3.2+) is authorized until P3.1 is formally reviewed and approved by the engineering leads.
