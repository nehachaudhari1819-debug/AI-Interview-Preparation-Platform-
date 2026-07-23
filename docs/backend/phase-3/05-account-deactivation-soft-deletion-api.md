# 1. Title and status

**Title:** Phase 3.5 Account Deactivation and Soft-Deletion API
**Status:** IMPLEMENTED — REVIEW PENDING

# 2. Purpose

This document outlines the implementation of the `DELETE /api/v1/users/me` endpoint. It securely handles the soft-deletion (deactivation) of a user's account, invalidates their refresh sessions globally, clears local authentication cookies, and ensures a mandatory audit event is durably recorded.

# 3. Approved baseline

**Authorized branch:** `backend`
**Baseline:** `536e077` (Phase 3.4)

# 4. Scope

This implementation encompasses:

- Soft-deletion of the current user profile (setting `account_status = 'deleted'` and `deleted_at`).
- Revocation of Supabase refresh sessions.
- Clearing of the client's refresh-session cookie.
- Endpoint-specific Idempotency using the `Idempotency-Key` header.
- Endpoint-specific Audit logging for the `ACCOUNT_DEACTIVATED` event.

# 5. Non-goals

- Generalizing idempotency middleware across the entire application (deferred to P3.7).
- Generalizing audit middleware (deferred to P3.7).
- Changing RLS rules (deferred to P3.6).
- Hard deleting Supabase auth identities.
- Adding cascade deletes for relational data.

# 6. Endpoint contract

**DELETE /api/v1/users/me**

Requires Bearer Authentication and `Idempotency-Key` header.
Body: None.
Success: `200 OK`

# 7. Authentication flow

The endpoint uses standard bearer token authentication. The `req.user.id` is the strictly trusted principal identity. The `Idempotency-Key` prevents duplicate operations from being executed.

# 8. Trusted ownership source

No identity parameters (path, query, body) are accepted. The target user ID is inherently derived from the authenticated JWT.

# 9. Idempotency-Key contract

- The `Idempotency-Key` header must be present exactly once.
- The value must be a non-empty string under 255 characters.
- Must not contain control characters.
- Missing key returns `400 IDEMPOTENCY_KEY_REQUIRED`.
- Invalid key returns `400 IDEMPOTENCY_KEY_INVALID`.
- Conflicting key (same key, different request signature) returns `409 IDEMPOTENCY_CONFLICT`.

# 10. Idempotency scope and fingerprint

Scope: Authenticated User ID.
Fingerprint: `DELETE:/api/v1/users/me:v1`

# 11. Idempotency persistence

Uses the existing `public.idempotency_records` table via the `AccountDeletionIdempotencyRepository`. Records are valid for 24 hours.

# 12. Concurrent request behavior

If multiple identical requests hit the server, the database enforces a unique constraint (`user_id`, `operation`, `idempotency_key`), ensuring only one operation reserves the "processing" state. Others will either block, wait, or replay based on the outcome.

# 13. Account lifecycle state machine

`active` -> `deleted` (Soft-deleted).
Once `deleted`, matching replay requests return `200 OK`. New requests return `403 ACCOUNT_DELETED`.

# 14. Soft-deletion persistence

Implemented in `supabase-account-lifecycle.repository.ts`. Modifies exactly the two allowed fields (`account_status`, `deleted_at`) directly using a privileged connection scoped securely by the `userId`.

# 15. Privileged lifecycle boundary

The service role client is completely isolated inside the `supabase-account-lifecycle.repository.ts`, `account-deletion-idempotency.repository.ts`, and `account-deletion-audit.repository.ts`. It is never exposed to the controller or request bodies.

# 16. Session-revocation architecture

The `AccountSessionRevocationGateway` accepts the user's `accessToken` to perform a `client.auth.admin.signOut(accessToken, "global")` call. This securely drops refresh sessions on the provider side across all devices. Provider failures are strictly caught and handled without exposing raw tokens or user IDs to application logs.

# 17. Refresh-cookie clearing

If the deletion process succeeds, the controller triggers `clearRefreshTokenCookie()` to ensure local application state correctly signals sign-out.

# 18. Access-token limitation

The existing JWT `access_token` may remain cryptographically valid until its natural expiry time. Subsequent requests to protected APIs will be blocked by `account_status` checks or RLS, despite valid token signatures.

# 19. Audit event

An immutable `ACCOUNT_DEACTIVATED` event is appended to `public.audit_logs`.

# 20. Failure ordering and recovery

1. **Prepare Phase (RPC)**:
   - Lock user row (`SELECT FOR UPDATE`).
   - Recheck idempotency. Reject already deleted accounts.
   - Reserve idempotency.
   - Soft deletion applied.
   - Audit recorded.
   - Return indicating `session_revocation_required`.
2. **Service Phase**:
   - Provider sessions revoked. (If this fails, the operation throws, leaving idempotency safely in `processing`).
3. **Finalize Phase (RPC)**:
   - Idempotency completed and safe replay response stored.

Failure in intermediate steps leaves the idempotency record in a state allowing safe retry if not logically fatal. A retry while in `processing` will resume at the session revocation and finalization phase without duplicating the soft-deletion or audit log inserts.

# 21. Controller architecture

The `createDeleteMeController` coordinates these isolated components securely.

# 22. Router and middleware order

`authNoStoreMiddleware` -> Rate Limiting -> `authMiddleware` -> Service Middleware -> Controller.

# 23. Rate limiting

Utilizes the existing strict authentication rate limiters to prevent brute-forcing.

# 24. Error mapping

Handled via `PersistenceError` converting safely into `AppError` mapped 4xx/5xx responses.

# 25. No-store policy

Enforced on `DELETE /api/v1/users/me`.

# 26. Logging and redaction

The raw `Idempotency-Key` and `accessToken` are not logged. The idempotency key is securely hashed prior to audit logging.

# 27. OpenAPI changes

`AccountDeletionResponse` schema added. `delete` operation added to `/api/v1/users/me`.

# 28-31. Testing

Unit, integration, security, and E2E coverage added.

# 32-34. Files Created/Modified

See task list artifact.

# 35-36. Database/RLS

No DB schemas changed. No RLS policies changed.

# 37-41. Next Steps

Handoff to P3.6 (Authorization and RLS integration).
