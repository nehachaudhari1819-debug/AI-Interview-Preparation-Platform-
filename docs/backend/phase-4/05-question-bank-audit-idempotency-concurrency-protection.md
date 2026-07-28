# P4.5 — Question Bank Audit, Idempotency, Replay and Concurrency Protection

**Status:** IMPLEMENTED — REVIEW PENDING
**Phase:** Backend — Phase 4 (Admin Question Bank)
**Depends on:** P4.4, P3.7 (Audit & Idempotency Foundation)
**No migration required** — reuses Phase 3 schema (audit_logs, idempotency_records, RPCs)

---

## Scope

This phase applies the Phase 3 idempotency and audit infrastructure to all nine
Question Bank administrative mutation routes. GET (read-only) routes are unchanged.

### Mutation Routes Protected

| Method | Route                                                        | Idempotency-Key | Audit Action                 | Resource Type       |
| ------ | ------------------------------------------------------------ | --------------- | ---------------------------- | ------------------- |
| POST   | `/api/v1/admin/questions`                                    | Required        | `QUESTION_CREATED`           | `question`          |
| PATCH  | `/api/v1/admin/questions/:questionId`                        | Required        | `QUESTION_UPDATED`           | `question`          |
| POST   | `/api/v1/admin/questions/:questionId/publish`                | Required        | `QUESTION_PUBLISHED`         | `question`          |
| POST   | `/api/v1/admin/questions/:questionId/archive`                | Required        | `QUESTION_ARCHIVED`          | `question`          |
| POST   | `/api/v1/admin/questions/:questionId/restore`                | Required        | `QUESTION_RESTORED`          | `question`          |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType`                     | Required        | `QUESTION_TAXONOMY_CREATED`  | `question_taxonomy` |
| PATCH  | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId`         | Required        | `QUESTION_TAXONOMY_UPDATED`  | `question_taxonomy` |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/archive` | Required        | `QUESTION_TAXONOMY_ARCHIVED` | `question_taxonomy` |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/restore` | Required        | `QUESTION_TAXONOMY_RESTORED` | `question_taxonomy` |

### Read Routes (unchanged)

| Method | Route                                 | Idempotency-Key |
| ------ | ------------------------------------- | --------------- |
| GET    | `/api/v1/admin/questions`             | Not applicable  |
| GET    | `/api/v1/admin/questions/:questionId` | Not applicable  |

---

## Architecture

### Infrastructure Reuse

P4.5 uses Phase 3 infrastructure without modification (except for two targeted
backward-compatible additions):

| Component                        | File                                       | Role                             |
| -------------------------------- | ------------------------------------------ | -------------------------------- |
| `withIdempotency`                | `src/middleware/idempotency.middleware.ts` | Per-route lease management       |
| `createAuditMiddleware`          | `src/middleware/audit.middleware.ts`       | Fire-and-forget audit logging    |
| `acquire_idempotency_lease` RPC  | Migration 14                               | Atomic lease acquisition         |
| `complete_idempotency_lease` RPC | Migration 14                               | Completion with response storage |
| `fail_idempotency_lease` RPC     | Migration 14                               | Release on error                 |
| `audit_logs` table               | Migration 14                               | Immutable audit record store     |

### New Files

| File                                                              | Purpose                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `src/features/questions/admin-questions-audit.constants.ts`       | Audit action constants and safe metadata builders    |
| `src/features/questions/admin-questions-idempotency.constants.ts` | Idempotency operation identifiers and route patterns |

### Modified Files

| File                                               | Change                                                                         |
| -------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/features/questions/admin-questions.router.ts` | Applied `withIdempotency` + `createAuditMiddleware` to all 9 mutation routes   |
| `src/middleware/idempotency.middleware.ts`         | Added `res.locals.isIdempotencyReplay = true` before sending replay response   |
| `src/middleware/audit.middleware.ts`               | Added `res.locals.isIdempotencyReplay` check to skip duplicate audit on replay |

---

## Middleware Ordering

```
[Router-level guards]
  → authenticate (JWT)
  → requireActiveAccount
  → requireAdminRole
[Per-route chain for mutations]
  → jsonContentTypeGuard   (POST/PATCH only)
  → jsonBodyParser          (POST/PATCH only)
  → createAuditMiddleware   (registers res.on("finish") listener)
  → withIdempotency wrapper
      ├─ acquire lease (RPC)
      │   ├─ acquired    → execute handler → set res.locals.auditResourceId + metadata
      │   │               → complete lease (awaited) → send response
      │   ├─ replay      → set res.locals.isIdempotencyReplay=true → send cached response
      │   ├─ conflict    → 409 IDEMPOTENCY_CONFLICT
      │   └─ in_progress → 409 IDEMPOTENCY_IN_PROGRESS
      └─ on error → fail lease
[Response sent]
  → res.on("finish") fires
      └─ audit middleware: if isIdempotencyReplay → skip (no duplicate audit)
         else: insert audit_log (fire-and-forget)
```

---

## Idempotency Behavior

### Idempotency Key Scoping

Each idempotency record is scoped to:

- `userId` (from authenticated JWT — cannot be forged by client)
- `operation` (stable string from `QUESTION_IDEMPOTENCY_OPERATIONS` / `TAXONOMY_IDEMPOTENCY_OPERATIONS`)
- `idempotencyKey` (from `Idempotency-Key` header)

This means:

- User A cannot replay User B's operations, even with the same key
- The same key is valid independently for each distinct operation

### Request Fingerprinting

The request fingerprint (SHA-256) is computed from:

- `apiVersion` (always "v1")
- `method` (uppercase)
- `routePattern` (canonical route from `QUESTION_BANK_ROUTE_PATTERNS`)
- `operation` (from operation constants)
- `body` (canonically serialized with sorted keys)

**Excluded from fingerprint:**

- `Authorization` header
- `Idempotency-Key` header
- `X-Request-ID`
- Client IP
- User-Agent
- Cookies

### State Machine

| Scenario                             | Response                                                     |
| ------------------------------------ | ------------------------------------------------------------ |
| New key + valid request              | Executes mutation, stores completion, returns 201/200        |
| Same key + same fingerprint (replay) | Returns cached response, no second mutation, no second audit |
| Same key + different fingerprint     | 409 `IDEMPOTENCY_CONFLICT` (permanent)                       |
| Same key + in-progress               | 409 `IDEMPOTENCY_IN_PROGRESS` (retry later)                  |
| Missing `Idempotency-Key`            | 400 `IDEMPOTENCY_KEY_REQUIRED`                               |
| Invalid key format                   | 400 `IDEMPOTENCY_KEY_INVALID`                                |
| Acquisition fails (DB unavailable)   | 503 `SERVICE_UNAVAILABLE`                                    |

---

## Audit Contract

### Audit Record Structure

```json
{
  "action": "QUESTION_CREATED",
  "resource_type": "question",
  "resource_id": "<question-uuid>",
  "actor_user_id": "<admin-user-uuid>",
  "actor_type": "user",
  "request_id": "<request-uuid>",
  "ip_address": "<client-ip>",
  "user_agent": "<user-agent>",
  "metadata": {
    "operation": "QUESTION_CREATED",
    "providedFields": [
      "categoryId",
      "difficultyId",
      "interviewTypeId",
      "questionText",
      "referenceAnswer",
      "skillIds"
    ]
  }
}
```

### Safe Metadata Policy

The audit metadata contains **only field names** (sorted) — never field values.
This means:

- `referenceAnswer` field name → allowed in metadata
- The text content of `referenceAnswer` → excluded
- `evaluationGuidance` field name → allowed
- The rubric/guidance content → excluded
- `slug` field name → allowed
- The actual slug string → excluded

### Failure Policy

Audit logging is **fire-and-forget** (`res.on("finish")` after response is sent).

- Audit failure does NOT roll back the mutation
- Audit failure does NOT affect the HTTP response
- Audit failure is logged at `error` level with event `system.audit.persistence_failed`

This policy is consistent with the P3.7 contract for optional operational events.

### Replay Suppression

When `withIdempotency` detects a replay:

1. Sets `res.locals.isIdempotencyReplay = true`
2. Sends the cached response
3. `res.on("finish")` fires
4. `createAuditMiddleware` checks `res.locals.isIdempotencyReplay` → skips audit insert

This ensures exactly one audit event per mutation, regardless of how many replay calls are made.

---

## Concurrency Protection

### Same Key, Concurrent Requests

The `acquire_idempotency_lease` RPC is atomic (implemented with
`INSERT … ON CONFLICT DO UPDATE … RETURNING …`). The first caller wins the lease;
subsequent concurrent callers receive `in_progress` and should retry.

This prevents double-mutation when two instances of the same client fire simultaneously
with the same `Idempotency-Key`.

### Different Keys, Same Unique Field

Example: two admins create taxonomies with the same slug.

- First request: DB unique constraint satisfied → 201 Created
- Second request: `PersistenceError.RECORD_ALREADY_EXISTS` → normalized to 409 RESOURCE_CONFLICT

The error message does **not** include the constraint name or SQLSTATE code.

### Lifecycle State Conflicts

Lifecycle transitions (`publish`, `archive`, `restore`) validate the current status
before executing. Attempting an invalid transition (e.g., publish an already-published
question with a new Idempotency-Key) returns an appropriate business error (409/422).

---

## Security Properties

| Property               | Mechanism                                                     |
| ---------------------- | ------------------------------------------------------------- |
| Admin-only access      | `requireAdminRole` middleware applied at router level         |
| JWT forgery protection | Key is scoped to `userId` from validated JWT claims           |
| RLS applied            | Mutations use user-scoped Supabase client                     |
| Audit data safety      | Metadata builders produce field-names-only records            |
| No credential leakage  | Audit metadata builders exclude tokens, credentials, SQL      |
| No DB detail leakage   | `PersistenceError` normalizer strips constraint names         |
| No raw key leakage     | `parseIdempotencyKey` failure result does not contain raw key |
| Fingerprint is one-way | SHA-256 hash; referenceAnswer content not recoverable         |

---

## Operations Reference

### Idempotency Operation Identifiers

```typescript
// Questions
QUESTION_IDEMPOTENCY_OPERATIONS.CREATE_QUESTION = "admin_create_question";
QUESTION_IDEMPOTENCY_OPERATIONS.UPDATE_QUESTION = "admin_update_question";
QUESTION_IDEMPOTENCY_OPERATIONS.PUBLISH_QUESTION = "admin_publish_question";
QUESTION_IDEMPOTENCY_OPERATIONS.ARCHIVE_QUESTION = "admin_archive_question";
QUESTION_IDEMPOTENCY_OPERATIONS.RESTORE_QUESTION = "admin_restore_question";

// Taxonomies
TAXONOMY_IDEMPOTENCY_OPERATIONS.CREATE_TAXONOMY = "admin_create_taxonomy";
TAXONOMY_IDEMPOTENCY_OPERATIONS.UPDATE_TAXONOMY = "admin_update_taxonomy";
TAXONOMY_IDEMPOTENCY_OPERATIONS.ARCHIVE_TAXONOMY = "admin_archive_taxonomy";
TAXONOMY_IDEMPOTENCY_OPERATIONS.RESTORE_TAXONOMY = "admin_restore_taxonomy";
```

> **Important:** Do not change these identifiers. Changing them would invalidate
> all in-flight idempotency records for those operations.

### Audit Action Constants

```typescript
// Questions
QUESTION_AUDIT_ACTIONS.QUESTION_CREATED = "QUESTION_CREATED";
QUESTION_AUDIT_ACTIONS.QUESTION_UPDATED = "QUESTION_UPDATED";
QUESTION_AUDIT_ACTIONS.QUESTION_PUBLISHED = "QUESTION_PUBLISHED";
QUESTION_AUDIT_ACTIONS.QUESTION_ARCHIVED = "QUESTION_ARCHIVED";
QUESTION_AUDIT_ACTIONS.QUESTION_RESTORED = "QUESTION_RESTORED";

// Taxonomies
TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_CREATED = "QUESTION_TAXONOMY_CREATED";
TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_UPDATED = "QUESTION_TAXONOMY_UPDATED";
TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_ARCHIVED = "QUESTION_TAXONOMY_ARCHIVED";
TAXONOMY_AUDIT_ACTIONS.QUESTION_TAXONOMY_RESTORED = "QUESTION_TAXONOMY_RESTORED";
```

---

## Test Coverage

| Test File                                                           | Coverage                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `tests/unit/features/questions/admin-questions-audit.spec.ts`       | Audit constants, metadata builders, field-name-only redaction             |
| `tests/unit/features/questions/admin-questions-idempotency.spec.ts` | Operation constants, route patterns, fingerprint determinism              |
| `tests/security/question-bank-idempotency-boundary.spec.ts`         | 401 for all 9 routes, key validation, fingerprint security, error hygiene |
| `tests/e2e/phase-4/question-bank-audit-idempotency.e2e.spec.ts`     | Full lifecycle: create→replay→conflict, audit counting, concurrency       |

---

## Limitations and Future Work

| Limitation                                          | Reason                                                                        | Mitigation                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------- |
| Audit is fire-and-forget                            | Consistent with P3.7 contract; strict atomic audit would require Migration 21 | Audit failure is logged at error level          |
| No pgTAP test for audit_logs row on question events | Requires Migration 21 SQL-level test hooks                                    | E2E tests via testAdminClient cover this        |
| Cross-user replay security is tested indirectly     | Lease scoped to userId at DB level                                            | DB constraint test in pgTAP available in future |
