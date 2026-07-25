# Phase 3 — Frontend Handoff

**Project:** PrepPulse AI — AI Interview Preparation Platform
**Phase:** 3
**Status:** IMPLEMENTED — FORMAL REVIEW PENDING
**Prepared for:** Frontend Developer
**Prepared by:** Backend Team
**Date:** 2026-07-25
**Baseline Commit:** 64a15ab208482bba48d255f31b4bd2f5971f9927
**Backend CI:** #93 — Success

---

## Purpose

This document is the authoritative frontend integration contract for all Phase 3 backend APIs.
It covers authentication assumptions, all five Phase 3 endpoints, and the complete list of
frontend security rules. It does not contain frontend implementation code.

The backend is ready for frontend integration as of commit `64a15ab`.

---

## 1. Authentication Assumptions

### 1.1 Bearer Access Token

Every Phase 3 protected endpoint requires a valid bearer access token in the
`Authorization` header:

```
Authorization: Bearer <access_token>
```

- The access token is a short-lived JWT issued by Supabase Auth upon login or registration.
- Obtain it from `POST /api/v1/auth/login` or `POST /api/v1/auth/register`.
- Store it in memory only. Never store it in `localStorage` or `sessionStorage`.
- Do not decode or trust its claims on the frontend. The backend verifies it.

### 1.2 Refresh Session Behavior

- A long-lived refresh session cookie (`auth_session`) is set `HttpOnly` and `Secure`
  automatically by the server at login.
- The cookie cannot be read by JavaScript.
- All requests to auth endpoints must include `credentials: "include"` (Fetch) or
  `withCredentials: true` (Axios) to ensure the cookie is transmitted.

### 1.3 Token Refresh Flow

When any protected request returns `401 Unauthorized`:

1. Call `POST /api/v1/auth/refresh` with credentials.
2. On success: update the stored access token and retry the original request once.
3. On failure (refresh returns `401`): the session is fully expired.
   Clear the access token from memory and redirect to the login screen.

### 1.4 403 Inactive Account Handling

When a protected request returns `403 Forbidden` with code `ACCOUNT_DISABLED` or
`ACCOUNT_DELETED`, the account is no longer active. The frontend should:

1. Clear the access token.
2. Redirect to an appropriate screen (login or an "account deactivated" page).
3. Do not retry the request automatically.

---

## 2. Standard Response Envelope

Every response (success or error) uses a consistent envelope.

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "uuid-v4"
  }
}
```

### Error

```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "STABLE_ERROR_CODE",
  "errors": [{ "field": "fieldName", "message": "reason" }],
  "meta": {
    "requestId": "uuid-v4"
  }
}
```

The `errors` array is present only for validation failures.

Every response includes an `X-Request-ID` response header for support tracing.

---

## 3. Profile Endpoints

### 3.1 GET /api/v1/users/me

**Purpose:** Retrieve the authenticated user's canonical profile.

**Method:** `GET`
**Path:** `/api/v1/users/me`
**Authentication:** Required (Bearer Token)

#### Required Headers

```
Authorization: Bearer <access_token>
```

#### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "student@example.com",
      "fullName": "Example Student",
      "college": "Institute of Technology",
      "branch": "Computer Science",
      "graduationYear": 2027,
      "experienceLevel": "fresher",
      "preferredRoles": ["backend-developer"],
      "bio": "Preparing for technical interviews.",
      "avatarUrl": null,
      "role": "student",
      "accountStatus": "active",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "meta": { "requestId": "uuid" }
}
```

`deletedAt` is never returned. `accountStatus` is included for UI awareness only.
Do not make authorization decisions on the frontend based on `accountStatus`.

#### Error Behavior

| Condition             | Status | Code                      |
| :-------------------- | :----- | :------------------------ |
| Missing token         | 401    | `AUTHENTICATION_REQUIRED` |
| Invalid/expired token | 401    | `INVALID_ACCESS_TOKEN`    |
| Account suspended     | 403    | `ACCOUNT_DISABLED`        |
| Account deleted       | 403    | `ACCOUNT_DELETED`         |
| Profile not found     | 404    | `USER_PROFILE_NOT_FOUND`  |
| Database unavailable  | 503    | `SERVICE_UNAVAILABLE`     |

#### Cache Behavior

Response always carries `Cache-Control: no-store`. Do not cache profile responses.

#### Idempotency

Not applicable. Read-only endpoint.

---

### 3.2 PATCH /api/v1/users/me

**Purpose:** Partially update the authenticated user's profile.

**Method:** `PATCH`
**Path:** `/api/v1/users/me`
**Authentication:** Required (Bearer Token)
**Content-Type:** `application/json`

#### Required Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Request Body — Allowed Fields

Send only the fields you intend to update. All fields are optional, but at least one
must be present.

```json
{
  "fullName": "New Name",
  "college": "New College",
  "branch": "New Branch",
  "graduationYear": 2028,
  "experienceLevel": "intermediate",
  "preferredRoles": ["backend-developer", "devops"],
  "bio": "Updated bio.",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Field Rules:**

| Field             | Type            | Constraints                                                       |
| :---------------- | :-------------- | :---------------------------------------------------------------- |
| `fullName`        | string          | 1–100 characters, cannot be empty string                          |
| `college`         | string \| null  | Max 150 characters. `null` or empty string clears the value       |
| `branch`          | string \| null  | Max 100 characters. `null` or empty string clears the value       |
| `graduationYear`  | integer \| null | 2000–2100. `null` clears the value                                |
| `experienceLevel` | enum \| null    | One of: `fresher`, `beginner`, `intermediate`, `advanced`         |
| `preferredRoles`  | string[]        | Max 10 items, max 50 chars each. Empty array clears. Auto-deduped |
| `bio`             | string \| null  | Max 500 characters. `null` or empty string clears the value       |
| `avatarUrl`       | string \| null  | Valid `https://` URL, max 2048 characters. `null` clears          |

**Protected fields — never send:** `id`, `email`, `role`, `accountStatus`, `createdAt`,
`updatedAt`, `deletedAt`. The backend rejects requests that include them with `422`.

#### Response — 200 OK

Returns the full updated profile in the same shape as `GET /api/v1/users/me`.

#### Error Behavior

| Condition              | Status | Code                      |
| :--------------------- | :----- | :------------------------ |
| Missing token          | 401    | `AUTHENTICATION_REQUIRED` |
| Invalid/expired token  | 401    | `INVALID_ACCESS_TOKEN`    |
| Account suspended      | 403    | `ACCOUNT_DISABLED`        |
| Account deleted        | 403    | `ACCOUNT_DELETED`         |
| Empty or invalid body  | 422    | `VALIDATION_ERROR`        |
| Unknown/protected keys | 422    | `VALIDATION_ERROR`        |
| Profile not found      | 404    | `USER_PROFILE_NOT_FOUND`  |
| Database unavailable   | 503    | `SERVICE_UNAVAILABLE`     |

#### Cache Behavior

Response always carries `Cache-Control: no-store`.

#### Idempotency

Not applicable. No `Idempotency-Key` required or accepted for this endpoint.

#### Audit Behavior

Every genuine field change records a `PROFILE_UPDATED` event in the backend audit log.
The audit record contains only changed field names, not old or new values.

---

### 3.3 DELETE /api/v1/users/me

**Purpose:** Soft-delete (deactivate) the authenticated user's account.

**Method:** `DELETE`
**Path:** `/api/v1/users/me`
**Authentication:** Required (Bearer Token)

#### Required Headers

```
Authorization: Bearer <access_token>
Idempotency-Key: <uuid-or-unique-string>
```

**`Idempotency-Key` is mandatory.** The value must be:

- Present exactly once.
- A non-empty string of maximum 255 characters.
- No control characters.
- Best practice: UUID v4 generated client-side before presenting the confirmation dialog.

#### Request Body

None.

#### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "message": "Account successfully deactivated.",
    "userId": "uuid",
    "deletedAt": "2026-07-25T14:00:00.000Z"
  },
  "meta": { "requestId": "uuid" }
}
```

#### Idempotency Behavior

- Replaying the same `Idempotency-Key` for the same user after a successful deletion
  returns `200 OK` with the original response. No duplicate deactivation occurs.
- Reusing the key with a different operation fingerprint returns `409 IDEMPOTENCY_CONFLICT`.
- Missing key returns `400 IDEMPOTENCY_KEY_REQUIRED`.

**After receiving `200 OK`:** Clear the access token, clear all UI session state, and
redirect to a post-deletion screen. Do not retry with a new key.

#### Error Behavior

| Condition               | Status | Code                       |
| :---------------------- | :----- | :------------------------- |
| Missing idempotency key | 400    | `IDEMPOTENCY_KEY_REQUIRED` |
| Invalid idempotency key | 400    | `IDEMPOTENCY_KEY_INVALID`  |
| Missing token           | 401    | `AUTHENTICATION_REQUIRED`  |
| Invalid/expired token   | 401    | `INVALID_ACCESS_TOKEN`     |
| Account already deleted | 403    | `ACCOUNT_DELETED`          |
| Idempotency conflict    | 409    | `IDEMPOTENCY_CONFLICT`     |
| Database unavailable    | 503    | `SERVICE_UNAVAILABLE`      |

#### Cache Behavior

Response always carries `Cache-Control: no-store`.

#### Session Revocation

On success, the backend revokes all refresh sessions globally across all devices.
The user's current refresh cookie is cleared. Subsequent refresh attempts will fail.

#### Account Lifecycle After Deletion

The user's auth identity and public profile row are preserved for audit integrity.
`account_status` is set to `deleted`. No data is hard-deleted in Phase 3.

---

## 4. Preferences Endpoints

### 4.1 GET /api/v1/users/me/preferences

**Purpose:** Retrieve the authenticated user's platform preferences.

**Method:** `GET`
**Path:** `/api/v1/users/me/preferences`
**Authentication:** Required (Bearer Token)

#### Required Headers

```
Authorization: Bearer <access_token>
```

#### Response — 200 OK

```json
{
  "success": true,
  "data": {
    "locale": "en",
    "timeZone": "UTC",
    "practiceRemindersEnabled": false,
    "weeklyProgressSummaryEnabled": false,
    "productUpdatesEnabled": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "meta": { "requestId": "uuid" }
}
```

The response does not include `userId` or any other ownership field.

Every user has exactly one preferences row provisioned automatically on account creation
with the defaults shown above.

#### Error Behavior

| Condition             | Status | Code                      |
| :-------------------- | :----- | :------------------------ |
| Missing token         | 401    | `AUTHENTICATION_REQUIRED` |
| Invalid/expired token | 401    | `INVALID_ACCESS_TOKEN`    |
| Account suspended     | 403    | `ACCOUNT_DISABLED`        |
| Account deleted       | 403    | `ACCOUNT_DELETED`         |
| Database unavailable  | 503    | `SERVICE_UNAVAILABLE`     |

#### Cache Behavior

Response always carries `Cache-Control: no-store`.

#### Idempotency

Not applicable. Read-only endpoint.

---

### 4.2 PATCH /api/v1/users/me/preferences

**Purpose:** Partially update the authenticated user's platform preferences.

**Method:** `PATCH`
**Path:** `/api/v1/users/me/preferences`
**Authentication:** Required (Bearer Token)
**Content-Type:** `application/json`

#### Required Headers

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

#### Request Body — Allowed Fields

Send only the preferences you intend to change. At least one field is required.

```json
{
  "locale": "fr-FR",
  "timeZone": "Europe/Paris",
  "practiceRemindersEnabled": true,
  "weeklyProgressSummaryEnabled": false,
  "productUpdatesEnabled": true
}
```

**Field Rules:**

| Field                          | Type    | Constraints                                                        |
| :----------------------------- | :------ | :----------------------------------------------------------------- |
| `locale`                       | string  | Valid BCP 47 locale tag. Max 35 characters. No control characters. |
| `timeZone`                     | string  | Valid IANA time zone identifier. Max 64 characters.                |
| `practiceRemindersEnabled`     | boolean | JSON boolean only (`true`/`false`). Never a string.                |
| `weeklyProgressSummaryEnabled` | boolean | JSON boolean only (`true`/`false`). Never a string.                |
| `productUpdatesEnabled`        | boolean | JSON boolean only (`true`/`false`). Never a string.                |

**Locale rules:**

- Must be a valid BCP 47 locale tag (e.g. `en`, `en-US`, `fr-FR`, `zh-Hans`).
- Invalid locale format is rejected with `400 VALIDATION_ERROR`.

**Time-zone rules:**

- Must be a valid IANA time zone identifier recognized by `Intl.supportedValuesOf("timeZone")`.
- `UTC` is always valid. Example valid values: `America/New_York`, `Europe/London`, `Asia/Kolkata`.
- Invalid time zone is rejected with `400 VALIDATION_ERROR`.

**Boolean rules:**

- Send JSON `true` or `false` only.
- Strings like `"true"`, `"false"`, `"1"`, `"0"` are rejected.

**Unknown fields are rejected** with `400 VALIDATION_ERROR`.
**Ownership field injection (`userId`) is blocked.**

#### No-op Behavior

If the submitted values are identical to the stored values, the backend returns `200 OK`
with the existing preferences. The `updatedAt` timestamp does not change.
No audit record is created for a no-op update.

#### Complete Response Behavior

The response always returns the full, current preferences object, including fields that
were not part of the request:

```json
{
  "success": true,
  "data": {
    "locale": "fr-FR",
    "timeZone": "Europe/Paris",
    "practiceRemindersEnabled": true,
    "weeklyProgressSummaryEnabled": false,
    "productUpdatesEnabled": false,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-07-25T14:00:00.000Z"
  },
  "meta": { "requestId": "uuid" }
}
```

#### Error Behavior

| Condition               | Status | Code                      |
| :---------------------- | :----- | :------------------------ |
| Missing token           | 401    | `AUTHENTICATION_REQUIRED` |
| Invalid/expired token   | 401    | `INVALID_ACCESS_TOKEN`    |
| Account suspended       | 403    | `ACCOUNT_DISABLED`        |
| Account deleted         | 403    | `ACCOUNT_DELETED`         |
| Empty body              | 400    | `VALIDATION_ERROR`        |
| Unknown fields          | 400    | `VALIDATION_ERROR`        |
| Invalid locale or tz    | 400    | `VALIDATION_ERROR`        |
| Non-boolean for boolean | 400    | `VALIDATION_ERROR`        |
| Database unavailable    | 503    | `SERVICE_UNAVAILABLE`     |

#### Cache Behavior

Response always carries `Cache-Control: no-store`.

#### Idempotency

Not applicable. No `Idempotency-Key` required or accepted for this endpoint.

#### Audit Behavior

Every genuine preference change creates a `USER_PREFERENCES_UPDATED` audit event on the
backend. The audit record contains only the names of changed fields. No preference values
are stored in the audit log.

---

## 5. Frontend Security Rules

The following rules are mandatory.

### Identity and Authorization

- **Never** send `userId`, `user_id`, or any user identifier in request bodies, query
  strings, or custom headers. The backend derives identity exclusively from the JWT.
- **Never** calculate ownership on the frontend. Only the backend enforces ownership.
- **Never** send service-role or anon Supabase credentials from frontend code.

### Authentication Tokens

- Store access tokens in memory only (React state or a closure). Never in `localStorage`,
  `sessionStorage`, or cookies managed by JavaScript.
- **Never** expose the Supabase refresh token to JavaScript. It is managed as an
  `HttpOnly` cookie by the server.

### Request Rules

- **Never** send `null` for a field unless the API contract explicitly marks it nullable.
- **Never** send string representations of booleans. Always use JSON boolean values.
- **Never** attach `Idempotency-Key` to `GET` or `PATCH` requests.
- **Always** attach a fresh unique `Idempotency-Key` before initiating account deletion.
  Generate it client-side (UUID v4). Do not reuse it for a different deletion attempt.

### Cache and Response Handling

- All Phase 3 profile and preference responses carry `Cache-Control: no-store`.
  Do not cache them.
- Do not expect audit records in any API response. Audit events are backend-internal only.

### Error Handling

- Surface `requestId` (from `meta.requestId`) in the UI so users can report it for
  support tracing.
- Do not display raw backend error messages to end users. Map `code` values to
  user-friendly messages.
- A `403 ACCOUNT_DISABLED` or `403 ACCOUNT_DELETED` response is terminal for the session.
  Sign the user out immediately.

---

## 6. OpenAPI Reference

The complete machine-readable API contract is available at:

```
docs/backend/openapi/openapi.json
```

This file is generated from source and is always consistent with the implementation.
Import it into Postman, Insomnia, or Swagger UI for interactive exploration.

---

## 7. Known Limitations (Phase 3)

The following are deliberate Phase 3 scope boundaries, not defects:

- **Email changes** are not supported. Email is read-only in Phase 3.
- **Password changes** are not supported via the profile API.
- **Avatar file uploads** are not supported. Only HTTPS URLs for externally hosted images.
- **Hard deletion** is not implemented. Deactivated accounts are soft-deleted only.
- **Phase 4 entities** (questions, interviews, resumes) do not exist yet.
- **MFA** is not supported.
- **Admin APIs** do not exist.

---

_This document covers the complete Phase 3 backend API surface. Do not implement
Phase 4 frontend features until Phase 4 is formally authorized._
