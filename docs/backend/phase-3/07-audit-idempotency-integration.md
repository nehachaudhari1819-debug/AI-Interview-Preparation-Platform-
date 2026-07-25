# 07 — Audit & Idempotency Integration

**Phase:** 3.7  
**Status:** IMPLEMENTED — REVIEW PENDING  
**Authorized Branch:** backend  
**Approved Baseline:** ce874c4 (Backend CI #79 — Success)

---

## 1. Scope

P3.7 delivers a durable audit and idempotency foundation for the PrepPulse AI backend. It closes the durability gap in the existing candidate code and establishes production-ready domain contracts.

**In scope:**

- PROFILE_UPDATED transactional audit (via DB trigger)
- Durable audit integration for PATCH /api/v1/users/me
- Audit metadata rules (field names only, no values)
- Generic idempotency domain contracts
- Atomic idempotency lease acquisition, completion, and failure RPCs
- Idempotency key validation
- Request fingerprinting with canonical serialization
- Processing lease expiration and stale-lock recovery
- Safe replay and conflict handling
- Logging event separation and redaction

**Out of scope:** Question bank, interview, resume, AI integrations, admin APIs, frontend, Phase 4.

---

## 2. Non-Goals

- Generic idempotency is not attached to PATCH /me (would be a breaking frontend change requiring a new Idempotency-Key header).
- Generic idempotency is not attached to GET /me (read-only; idempotency is inapplicable).
- DELETE /me retains its specialized P3.5 lifecycle and is not replaced.
- No audit-list or idempotency-list APIs are created.
- No admin endpoints are added.

---

## 3. Approved Baseline

| Item      | Value          |
| --------- | -------------- |
| Commit    | ce874c4        |
| Branch    | backend        |
| CI run    | Backend CI #79 |
| CI result | success        |

---

## 4. Existing Candidate Code Review

The following candidate files existed prior to P3.7 formal execution:

| File                                               | Status                  | Defects Found                                                                                                                                                                                                                   |
| -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/middleware/audit.middleware.ts`               | **Retained, corrected** | Used fire-and-forget (`res.on("finish")`) for PROFILE_UPDATED. Used incorrect log event `systemAuditFailed`. Incorrectly hashed idempotency key into audit metadata.                                                            |
| `src/middleware/idempotency.middleware.ts`         | **Replaced**            | Monkey-patched `res.json` only. Completed records after response (`res.on("finish")`). Used stale status names (`"completed"`, `"processing"`). Reused `systemAuditFailed` log event for idempotency. Did not use domain layer. |
| `src/persistence/system/idempotency.repository.ts` | **Retained, corrected** | Now wired to atomic RPCs from migration 14.                                                                                                                                                                                     |
| `src/persistence/system/audit.repository.ts`       | **Retained, unchanged** | Correct generic event logger; properly scoped to optional events only.                                                                                                                                                          |
| `src/features/users/user-profile.router.ts`        | **Corrected**           | Removed fire-and-forget `profileAuditMiddleware` from PATCH /me.                                                                                                                                                                |
| `src/features/users/user-profile.controller.ts`    | **Corrected**           | Removed stale `res.locals.auditMetadata` injection for changedFields.                                                                                                                                                           |

---

## 5. Audit Architecture

### 5.1 PROFILE_UPDATED Durability Guarantee

**Architecture:** PostgreSQL trigger on `public.users`.

```
PATCH /api/v1/users/me
  → Express validates, authenticates, authorizes
  → updateCurrentUserProfile() calls Supabase Data API
      → UPDATE public.users SET ... WHERE id = auth.uid()
          → AFTER UPDATE trigger: audit_user_profile_update_trigger
              → private.audit_user_profile_update() executes
                  → Detects OLD vs NEW changes on approved fields
                  → If no approved fields changed → RETURN NEW (no audit)
                  → Inserts one PROFILE_UPDATED row into public.audit_logs
                  → INSERT failure → entire UPDATE rolls back
          ← UPDATE commits with audit OR both fail together
  ← HTTP 200 with updated profile
```

The audit insert occurs in the **same database transaction** as the profile update. If the audit insert fails (e.g., constraint violation), the profile update is rolled back. The HTTP response is only returned after the transaction commits successfully.

### 5.2 PROFILE_UPDATED Event

| Field           | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `action`        | `PROFILE_UPDATED`                                                           |
| `resource_type` | `user_profile`                                                              |
| `actor_user_id` | `auth.uid()` at time of update                                              |
| `actor_type`    | `user` (or `system` if no authenticated session)                            |
| `resource_id`   | `users.id` (the updated row)                                                |
| `metadata`      | `{ "changedFields": ["bio", "college"] }` — sorted, unique field names only |

### 5.3 Changed-Field Metadata

- **Detected from:** `OLD` vs `NEW` row comparison inside the trigger
- **Watched fields:** `full_name`, `college`, `branch`, `graduation_year`, `experience_level`, `preferred_roles`, `bio`, `avatar_url`
- **Never included:** old values, new values, email, id, role, account_status, created_at, updated_at, deleted_at
- **Format:** JSON array of field name strings, sorted alphabetically, deduplicated

### 5.4 No-Op Behavior

If the PATCH body contains only values identical to existing stored values, the trigger detects no changes (`array_length(v_changed_fields, 1) IS NULL`) and returns `RETURN NEW` without inserting into `audit_logs`. No audit record is created.

### 5.5 Audit Transaction Behavior

| Scenario                    | Profile Change        | Audit Created                             |
| --------------------------- | --------------------- | ----------------------------------------- |
| Successful change           | ✅ committed          | ✅ committed (same transaction)           |
| Audit insert fails          | ❌ rolled back        | ❌ none                                   |
| Validation failure (pre-DB) | ❌ not attempted      | ❌ none                                   |
| Authentication failure      | ❌ not attempted      | ❌ none                                   |
| Authorization/RLS failure   | ❌ rolled back by RLS | ❌ none                                   |
| No-op update                | ✅ committed (noop)   | ❌ trigger detects no changes             |
| Multiple fields changed     | ✅ committed          | ✅ exactly one audit with all field names |

### 5.6 Audit Trigger Security

The trigger function `private.audit_user_profile_update()` is secured as follows:

- Located in the `private` schema (not accessible to clients).
- `SECURITY DEFINER` with `SET search_path = ''`.
- All database object references are fully qualified.
- No dynamic SQL.
- `REVOKE EXECUTE FROM public, anon, authenticated` — trigger-only invocation.
- Direct client execution is impossible.

### 5.7 Audit Table RLS

`public.audit_logs` RLS status:

| Operation | anon       | authenticated | service_role                      |
| --------- | ---------- | ------------- | --------------------------------- |
| SELECT    | ❌ blocked | ❌ blocked    | ✅ allowed                        |
| INSERT    | ❌ blocked | ❌ blocked    | ✅ (trigger via SECURITY DEFINER) |
| UPDATE    | ❌ blocked | ❌ blocked    | ❌ blocked (append-only)          |
| DELETE    | ❌ blocked | ❌ blocked    | ❌ blocked (append-only)          |

### 5.8 Audit Privilege Model

The generic audit repository (`src/persistence/system/audit.repository.ts`) uses the service-role client. It is used only for optional operational events where fire-and-forget failure policy is acceptable.

For PROFILE_UPDATED, the trigger uses `SECURITY DEFINER` to insert into `public.audit_logs` without granting INSERT to any client role.

### 5.9 Account-Deletion Audit Preservation

The `ACCOUNT_DEACTIVATED` event is owned by the P3.5 lifecycle RPC (`public.deactivate_account_v2`). The trigger on `public.users` explicitly does NOT fire PROFILE_UPDATED when `account_status` changes, because `account_status` is not in the approved watched fields list. The P3.5 deletion audit is preserved exactly as approved.

---

## 6. Generic Audit Repository (Optional Events)

The generic `createAuditMiddleware` is retained for optional operational events where fire-and-forget is acceptable. It must NOT be registered on any route as the sole durability mechanism for mandatory audit events. Its failure policy is: log the error, do not affect the HTTP response.

---

## 7. Idempotency Architecture

### 7.1 Key Contract

| Rule           | Detail                                                              |
| -------------- | ------------------------------------------------------------------- |
| Header         | `Idempotency-Key`                                                   |
| Presence       | Required only on endpoints that explicitly adopt idempotency        |
| Format         | String, 1–255 characters, no control characters (0x00–0x1F, 0x7F)   |
| Uniqueness     | Exactly one header value; arrays rejected                           |
| Logging        | Raw key never logged; SHA-256 fingerprint used for correlation only |
| Error exposure | Raw key never included in error responses                           |

### 7.2 Request Fingerprint

The canonical fingerprint is a SHA-256 hex digest of:

```json
{
  "apiVersion": "v1",
  "method": "POST",
  "routePattern": "/users/me",
  "operation": "update_profile",
  "body": {/* sorted object keys, recursive */}
}
```

**Excluded from fingerprint:** Authorization header, Idempotency-Key, cookie, request ID, IP, user-agent.

Two requests with identical semantic content always produce the same fingerprint, regardless of JSON key ordering.

### 7.3 Domain Model

**Domain acquisition results (returned to middleware):**

| Status             | Meaning                               | HTTP Response               |
| ------------------ | ------------------------------------- | --------------------------- |
| `acquired`         | Lease granted; execute business logic | Call next()                 |
| `in_progress`      | Valid lease exists                    | 409 IDEMPOTENCY_IN_PROGRESS |
| `replay`           | Completed; return cached response     | 200/201 from cache          |
| `conflict`         | Different request hash                | 409 IDEMPOTENCY_CONFLICT    |
| `retryable_failed` | Temporary failure                     | 503                         |
| `unavailable`      | Service error                         | 503                         |

**Persistent record statuses (stored in DB):** `processing`, `completed`, `failed`.

### 7.4 Acquisition Lifecycle

```
First request with key K:
  INSERT ... ON CONFLICT DO NOTHING → inserts processing record → acquired

Same key, same hash, completed (unexpired):
  → status = replay, returns cached response

Same key, same hash, processing with valid lease:
  → status = in_progress (retry later)

Same key, same hash, processing with expired lease:
  → UPDATE: new lease token, increment attempt_count → acquired

Same key, different hash:
  → status = conflict (permanent)

Same key, failed record:
  → UPDATE: re-open as processing, increment attempt_count → acquired

Same key, completed (expired):
  → UPDATE: recycle as new processing record → acquired
```

### 7.5 Processing Lease

- Default duration: 60 seconds.
- Fields: `lease_token UUID`, `lease_expires_at TIMESTAMPTZ`.
- Only the current lease owner (matching `lease_token`) can complete or fail.
- A stale worker that held the old lease cannot overwrite a reclaimed record.
- A crashed worker does not block the key indefinitely — lease expires and can be reclaimed.

### 7.6 Completion Lifecycle

Completion is explicit and awaited **before** sending the HTTP response:

```
Business logic succeeds
↓
service.complete({ recordId, leaseToken, responseStatus, responseBody }) — awaited
↓
If complete() returns false (lease reclaimed) → log warning, still send response
If complete() throws → log error, still send response (business op already succeeded)
↓
originalSend(body) — response flushed to client
```

This is enforced by proxying `res.send()` and running the `await` inside the proxy. Do NOT use `res.on("finish")` for completion.

### 7.7 Failure Lifecycle

When a non-2xx response is sent:

```
Business logic fails
↓
service.fail({ recordId, leaseToken }) — awaited
↓
originalSend(body) — error response flushed to client
```

The `failed` record is retryable: the next acquisition for the same key increments `attempt_count` and re-grants a new lease.

### 7.8 Replay Behavior

For a completed, unexpired record with matching hash:

- Return the cached `response_status` and `response_body`.
- Do not execute the business handler.
- Do not call `next()`.

### 7.9 Conflict Behavior

For an existing record with a different `request_hash`:

- Return `409 IDEMPOTENCY_CONFLICT`.
- This is permanent — the key cannot be reused with a different body.

### 7.10 Stale Processing Recovery

If a `processing` record's `lease_expires_at` is in the past:

- The RPC atomically re-grants the lease with a new `lease_token`.
- `attempt_count` is incremented.
- The key becomes `acquired` for the new requester.
- The old worker's `complete()` call will return `false` (lease token mismatch).

### 7.11 Expiration

Completed records have an `expires_at` field (default 24 hours from creation). When `expires_at` is in the past, the completed record is recycled: it is reset to `processing` and re-granted as a new lease. This prevents indefinite replay of stale responses.

---

## 8. Express Integration Boundary

The middleware is a **thin adapter** only. It:

1. Validates the header via `parseIdempotencyKey()` (domain function).
2. Generates the fingerprint via `generateRequestFingerprint()` (domain function).
3. Acquires via `IdempotencyService.acquire()` (domain service).
4. Routes based on the typed domain result.
5. Proxies `res.send()` to await `service.complete()`.

The middleware does NOT:

- Manipulate raw database rows.
- Log raw keys or full hashes.
- Send the response before completion is confirmed.
- Use `res.on("finish")` as a durability mechanism.

### 8.1 Current Route Adoption Status

> **BACKEND FOUNDATION READY — NO CURRENT GENERIC ROUTE ADOPTION**

| Route                     | Idempotency         | Reason                                                   |
| ------------------------- | ------------------- | -------------------------------------------------------- |
| `GET /api/v1/users/me`    | ❌                  | Read-only; idempotency not applicable                    |
| `PATCH /api/v1/users/me`  | ❌                  | Breaking change to add required header; not authorized   |
| `DELETE /api/v1/users/me` | ✅ P3.5 specialized | P3.5 lifecycle preserved; generic middleware not applied |

### 8.2 P3.5 Specialized Flow Boundary

The DELETE /me endpoint retains its specialized P3.5 idempotency lifecycle (`deactivate_account_v2` RPC). The generic P3.7 middleware is not applied before or after it. No duplicate ACCOUNT_DEACTIVATED audit is created.

---

## 9. Database Migration

**File:** `supabase/migrations/20260101000014_phase3_7_audit_idempotency_integration.sql`

### Contents

1. **Lease fields added to `public.idempotency_records`:**
   - `lease_token UUID DEFAULT NULL`
   - `lease_expires_at TIMESTAMPTZ DEFAULT NULL`
   - `attempt_count INT NOT NULL DEFAULT 0`

2. **`private.audit_user_profile_update()` trigger function** — SECURITY DEFINER, `SET search_path = ''`, watches 8 approved fields.

3. **`audit_user_profile_update_trigger`** — AFTER UPDATE on `public.users`, FOR EACH ROW.

4. **`private.acquire_idempotency_lease()`** — Atomic acquire with INSERT ... ON CONFLICT, stale recovery, conflict detection. REVOKE from public/anon/authenticated, GRANT to service_role.

5. **`private.complete_idempotency_lease()`** — Requires matching lease token, exactly one row update. REVOKE/GRANT same as above.

6. **`private.fail_idempotency_lease()`** — Requires matching lease token, marks as failed. REVOKE/GRANT same as above.

### Security Review

All three RPCs and the trigger function comply with:

- `SET search_path = ''` ✅
- Fully qualified object references ✅
- No dynamic SQL ✅
- Input validation (UUID, TEXT, INT types enforced by PL/pgSQL) ✅
- `REVOKE EXECUTE FROM public, anon, authenticated` ✅
- `GRANT EXECUTE TO service_role` ✅

---

## 10. Logging & Redaction

### New Log Events (logging-events.constants.ts)

| Constant                                | Event String                                |
| --------------------------------------- | ------------------------------------------- |
| `systemAuditPersistenceFailed`          | `system.audit.persistence_failed`           |
| `systemIdempotencyAcquireFailed`        | `system.idempotency.acquire_failed`         |
| `systemIdempotencyCompleteFailed`       | `system.idempotency.complete_failed`        |
| `systemIdempotencyFailTransitionFailed` | `system.idempotency.fail_transition_failed` |
| `securityIdempotencyConflict`           | `security.idempotency.conflict`             |
| `securityIdempotencyInProgress`         | `security.idempotency.in_progress`          |

### New Redaction Paths (logging-redaction.constants.ts)

```
headers.idempotency-key
req.headers.idempotency-key
idempotencyKey
rawKey
leaseToken
requestHash
```

---

## 11. Error Contract

| Code                              | HTTP | Trigger                                   |
| --------------------------------- | ---- | ----------------------------------------- |
| `AUTHENTICATION_REQUIRED`         | 401  | No authenticated principal                |
| `IDEMPOTENCY_KEY_REQUIRED`        | 400  | Missing header                            |
| `IDEMPOTENCY_KEY_INVALID`         | 400  | Duplicate, empty, control chars, too long |
| `IDEMPOTENCY_IN_PROGRESS`         | 409  | Valid processing lease exists             |
| `IDEMPOTENCY_CONFLICT`            | 409  | Different request hash                    |
| `IDEMPOTENCY_SERVICE_UNAVAILABLE` | 503  | Retryable failure or unavailable          |

No error response includes: raw idempotency key, lease token, record ID, request hash, database constraint names, SQL text, stack traces.

---

## 12. OpenAPI Impact

No public API contracts have changed. PATCH /me does not require a new header. DELETE /me preserves P3.5 behavior. No new public endpoints are added.

---

## 13. Files Created

| File                                                                            | Purpose                               |
| ------------------------------------------------------------------------------- | ------------------------------------- |
| `supabase/migrations/20260101000014_phase3_7_audit_idempotency_integration.sql` | DB trigger, lease fields, atomic RPCs |
| `supabase/tests/0014_phase3_7_audit_idempotency_contract.sql`                   | pgTAP contract tests                  |
| `src/domain/audit/audit.types.ts`                                               | Technology-independent audit types    |
| `src/domain/idempotency/idempotency.types.ts`                                   | Domain type discriminated union       |
| `src/domain/idempotency/idempotency-key.ts`                                     | Pure key validation                   |
| `src/domain/idempotency/request-fingerprint.ts`                                 | Canonical SHA-256 fingerprinting      |
| `src/domain/idempotency/idempotency.repository.ts`                              | Domain repository interface           |
| `src/domain/idempotency/idempotency.service.ts`                                 | Pure domain service                   |
| `tests/unit/domain/idempotency-key.spec.ts`                                     | Key validation unit tests             |
| `tests/unit/domain/request-fingerprint.spec.ts`                                 | Fingerprint unit tests                |
| `tests/unit/domain/idempotency.service.spec.ts`                                 | Service unit tests                    |
| `tests/security/audit-idempotency-boundary.spec.ts`                             | Security boundary tests               |
| `tests/e2e/phase-3/audit-idempotency-integration.e2e.spec.ts`                   | Full E2E audit + idempotency suite    |
| `docs/backend/phase-3/07-audit-idempotency-integration.md`                      | This document                         |

---

## 14. Files Modified

| File                                                       | Change                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/middleware/audit.middleware.ts`                       | Scoped to optional events only; correct log event; removed misplaced idempotency key hashing |
| `src/middleware/idempotency.middleware.ts`                 | Full rewrite: domain layer, canonical fingerprint, correct states, pre-response completion   |
| `src/persistence/system/idempotency.repository.ts`         | Now uses atomic RPCs with lease tokens                                                       |
| `src/features/users/user-profile.router.ts`                | Removed fire-and-forget audit middleware from PATCH /me                                      |
| `src/features/users/user-profile.controller.ts`            | Removed stale auditMetadata injection                                                        |
| `src/observability/logging/logging-events.constants.ts`    | Added 6 new P3.7 log events                                                                  |
| `src/observability/logging/logging-redaction.constants.ts` | Added 6 idempotency redaction paths                                                          |
| `tests/unit/middleware/audit.middleware.spec.ts`           | Updated to test optional event behavior only                                                 |
| `tests/unit/middleware/idempotency.middleware.spec.ts`     | Updated to new status names and contracts                                                    |

---

## 15. Known Limitations

1. **Generic idempotency is not attached to any production route** — by deliberate design per the P3.7 approval scope. Future phases may add it to specific endpoints.

2. **Completion is best-effort when lease is lost** — if `complete()` returns `false` (lease was reclaimed), the response is still sent. The underlying business operation succeeded, but the idempotency record was taken over by a new attempt. This is documented and acceptable per the P3.7 design.

3. **Audit middleware fire-and-forget** — the generic audit middleware uses `res.on("finish")` with async fire-and-forget for optional operational events. Audit failure does not affect the HTTP response. This is explicitly accepted for non-mandatory events only.

---

## 16. Deferred Work

- P3.7 generic idempotency route adoption (deferred to a future phase when a suitable new endpoint exists).
- Idempotency record expiration cleanup job (deferred).
- P3.8 and all later Phase 3 work (not authorized).
- Phase 4 (not authorized).

---

## 17. Acceptance Criteria

See Section 59 of the P3.7 official implementation prompt for the full gate checklist. All criteria are addressed by this implementation.

---

## 18. Approval Checkpoint

**Status:** IMPLEMENTED — REVIEW PENDING

This document must not be updated to FORMALLY APPROVED or OFFICIALLY COMPLETED until the project reviewer has reviewed:

- Source diff
- Migration 14 content
- pgTAP results
- Unit test results
- E2E test results
- Local validation output
- CI result

Do not begin P3.8. Do not begin Phase 4.
