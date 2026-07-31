# Phase 5.4: Interview Session Lifecycle APIs

## Overview

This phase introduces the atomic state machine for interview session transitions:

- `SESSION_STARTED` (ready -> in_progress)
- `SESSION_PAUSED` (in_progress -> paused)
- `SESSION_RESUMED` (paused -> in_progress)
- `SESSION_COMPLETED` (in_progress/paused -> completed)

## Architecture

The system replaces Express-level idempotency wrappers and standard ORM mutations with a strict, unified PostgreSQL function (`transition_interview_session_lifecycle`).

1. **Transaction & Locking:** A single explicit transaction bounds the operation. A 64-bit transaction-scoped advisory lock prevents parallel execution of identical fingerprints.
2. **Idempotency & Replay:** The idempotency lease is acquired. If previously completed, the snapshot is replayed. If acquired, the mutation proceeds.
3. **Audit Log Atomicity:** The transition automatically logs to `audit_logs`.
4. **Completion:** The idempotency lease is completed with the final snapshot.

### Strict Contract

- **No Overlapping States:** Validates strict before-states and timestamp behaviors (e.g. `paused_at`, `total_paused_seconds`).
- **Private Engine:** The core transition engine is locked down (`SECURITY DEFINER`, private schema).
- **Public Wrappers:** 4 thin wrappers exist to validate ownership, enforce authentication, and call the private engine.
- **Resource Fingerprinting:** The request fingerprint uses `Idempotency-Key` along with `interview_id` and `session_id` in a resource-bound manner.

## Error Mapping

- `IDEMPOTENCY_COMPLETION_FAILED` is mapped to `OPERATION_FAILED` (HTTP 500).
- `RECORD_UPDATE_CONFLICT` (HTTP 409) is returned for invalid state transitions.
- `UNAUTHORIZED_ACCESS` (HTTP 403) is returned when users attempt to mutate sessions they do not own.

## Endpoints

- `POST /api/v1/interviews/:interviewId/sessions/:sessionId/start`
- `POST /api/v1/interviews/:interviewId/sessions/:sessionId/pause`
- `POST /api/v1/interviews/:interviewId/sessions/:sessionId/resume`
- `POST /api/v1/interviews/:interviewId/sessions/:sessionId/complete`

All endpoints require the `Idempotency-Key` header and will return an `X-Idempotency-Replay` header if the response was replayed.
