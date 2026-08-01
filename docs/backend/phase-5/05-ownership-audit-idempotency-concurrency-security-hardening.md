# P5.5 Ownership, Audit, Idempotency, Concurrency, and Security Hardening

## Overview

This document finalizes the Gate C architecture for Phase 5.5.

## 1. Concurrency and Locking

- `student_create_interview_session` utilizes `pg_try_advisory_xact_lock` keyed on `hashtext('idempotency:' || p_idempotency_key || ':' || _user_id::text)`.
- It acquires an explicit `SELECT ... FOR UPDATE` lock on the interview configuration to block concurrent edits.
- It leverages the existing unique partial index on `interview_sessions` (`WHERE status IN ('ready', 'in_progress', 'paused')`) to map race conditions to `409 RESOURCE_CONFLICT`.

## 2. Idempotency Behavior

- **Configuration (Create/Update):** Utilizes the generic application-level `withIdempotency` middleware.
- **Session Creation (RPC):** Implements atomic idempotency via `idempotency_records`.
  - **Replay:** Returns 201 with `X-Idempotency-Replay: true` and the exact original `snapshot`.
  - **In-Progress:** Returns `409 IDEMPOTENCY_IN_PROGRESS` if the key is still locked.
  - **Conflict:** Same key with a different request fingerprint (binding `user_id` + `operation` + `idempotency_key` + `request_hash`) returns P0007 IDEMPOTENCY_CONFLICT.

## 3. Strict RPC Parsing

- `student_create_interview_session` must return `{ replayed, response_status, snapshot, status, config_snapshot }`.
- Validates the `configSnapshot` safely redacts internal variables.

## 4. History Queries

- Support deterministic tie-breakers: `ORDER BY <sortBy> <sortDir>, id <sortDir>`.
- History API allows filtering by `status`, `createdFrom`, and `createdTo`.

## 5. Security Definition

- `student_create_interview_session` is `SECURITY DEFINER`.
- Ownership is checked dynamically via `auth.uid()`.
- Unowned resources yield `P0002 RESOURCE_NOT_FOUND`.
- Exposed RPC is explicitly revoked from `PUBLIC` and granted only to `authenticated`.
