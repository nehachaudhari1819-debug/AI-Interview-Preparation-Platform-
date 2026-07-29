# Phase 5.2 — Interview Session Database Schema, Constraints and RLS Foundation

**Status**: IMPLEMENTED — REVIEW PENDING

## Purpose

Establish the physical database schema, data integrity constraints, Row Level Security (RLS) policies, and hardening measures for Interview Configurations and Interview Sessions. This provides a robust persistence layer that enforces the business rules defined in Phase 5.1.

## Scope

- Creation of `interview_session_status_enum`.
- Creation of tables: `interviews`, `interview_skill_mappings`, `interview_topic_mappings`, `interview_sessions`, and `interview_session_questions`.
- Implementation of composite ownership integrity via foreign keys.
- Application of state-machine timestamp constraints and JSON schema validation.
- Implementation of immutability triggers for sessions and session questions.
- Hardening of RLS policies for active-account enforcement and state-aware question nondisclosure.
- Exhaustive pgTAP test suite verifying all schema, constraints, and privileges.

## Exclusions

- Runtime TypeScript controllers, services, or models (deferred to P5.3/P5.4).
- Mutations or RPCs for creating, updating, or deleting interviews and sessions (deferred to P5.3/P5.4).
- End-to-end integration tests (deferred to P5.6).
- User interface changes.

## P5.1 Traceability

This foundation directly implements the exact database schema, indexes, constraints, and RLS privilege design outlined in Section 23 through 26 of the `01-interview-lifecycle-requirements-state-machine-api-security-design.md` architecture document.

## Existing Pattern Assessment

The implementation strictly aligns with existing platform standards:

- RLS relies on the existing `auth.uid()` and `public.get_current_account_access_state()` patterns.
- Automatic timestamp updates use the existing `private.set_updated_at()` trigger.
- Security Definer triggers are correctly placed in the `private` schema and explicitly revoked from `PUBLIC`.

## Migration 21 Summary

Migration `20260101000021_phase5_2_interview_session_foundation.sql` creates the schema, applies hardened constraints and indexes, injects private trigger functions for immutability, enables RLS, and sets up least-privilege grants to the `authenticated` and `service_role` users.

## interviews schema

- Stores reusable interview intent configurations.
- Columns include `id`, `user_id`, `title`, `target_role`, taxonomy constraints (`interview_type_id`, `difficulty_id`), `question_count`, `time_limit_minutes`, and timestamps.
- Explicit non-empty text checks for title and target role.

## Skill mapping schema

- `interview_skill_mappings` joins `interviews` to `question_skills`.
- Uses a composite primary key `(interview_id, skill_id)`.

## Topic mapping schema

- `interview_topic_mappings` joins `interviews` to `question_topics`.
- Uses a composite primary key `(interview_id, topic_id)`.

## Session schema

- `interview_sessions` represents concrete execution attempts.
- Enforces strict composite ownership `(interview_id, user_id)` referencing the `interviews` table.
- Stores JSON snapshots of the configuration.
- Enforces timestamp presence corresponding to the exact `status` enum value.

## Session-question schema

- `interview_session_questions` persistently assigns a published question to a session.
- Tracks `display_order` (unique per session) and prevents duplicate questions per session.
- Stores `question_text_snapshot` and `taxonomy_snapshot` for historical integrity.

## Ownership integrity

A direct foreign key `(interview_id, user_id)` on `interview_sessions` references a unique constraint `(id, user_id)` on `interviews`. This database-level composite foreign key guarantees that a session can never be detached from its parent's owner.

## State constraints

Check constraints ensure that state progression matches timestamps:

- `ready` sessions must have all timestamps (except `created_at` and `last_transition_at`) `NULL` and `total_paused_seconds = 0`.
- Only `in_progress`, `paused`, and `completed` sessions can have a `started_at` value.
- `paused_at` and `completed_at` are strictly paired with their respective statuses.

## Timestamp behavior

Timestamps are enforced by `CHECK` constraints to only move forward logically (e.g., `completed_at >= started_at`, `updated_at >= created_at`). The standard `private.set_updated_at()` trigger handles `updated_at` progression.

## Immutability

`private.enforce_interview_session_immutable_fields()` prevents any UPDATE on `id`, `interview_id`, `user_id`, `created_at`, `config_snapshot`, and `config_snapshot_version` in the sessions table.
`private.prevent_interview_session_question_mutation()` prevents ANY `UPDATE` or `DELETE` on the `interview_session_questions` table to guarantee historical evidence preservation.

## Index rationale

- `user_id, created_at DESC` combinations facilitate efficient pagination queries.
- Taxonomy mapping tables are indexed on the target taxonomy `id` to allow quick lookup of associated interviews.
- `interview_session_questions` indexes `session_id` inherently through its unique constraint, and also indexes `question_id`.

## Active-attempt uniqueness

A partial unique index `idx_interview_sessions_active_session` on `interview_id` where `status != 'completed'` strictly prevents an interview from having more than one active session at a time.

## RLS policies

Five state-aware, student-scoped SELECT policies were applied:

- `interviews_student_read`
- `interview_skill_mappings_student_read`
- `interview_topic_mappings_student_read`
- `interview_sessions_student_read`
- `interview_session_questions_student_read`

No `INSERT`, `UPDATE`, or `DELETE` policies are defined. All mutations will require secure RPCs in future phases.

## Active-account enforcement

All SELECT RLS policies explicitly enforce `public.get_current_account_access_state() = 'active'`. Suspended or deleted users cannot access any data directly via the database connection.

## Privileges

`PUBLIC`, `anon`, and `authenticated` roles are explicitly revoked from everything. Only `SELECT` is granted back to `authenticated`. `service_role` has full `ALL` access for backend coordination. Enum usage is explicitly granted. Private triggers are secured via `SECURITY DEFINER` and hardened by revoking `PUBLIC` execution.

## Question Bank isolation

Session questions contain only public text and taxonomy. `question_internal_data` is neither referenced nor copied, successfully isolating `reference_answer` and `evaluation_guidance`.

## Audit and idempotency compatibility

By centralizing all structural integrity within schema definitions and RPC-ready triggers, the platform is fully compatible with Phase 5.5's upcoming `idempotency_records` and `audit_logs` integrations.

## Generated types

Database types are synchronized without manually overriding interfaces, maintaining a strict source of truth in the PostgreSQL schema.

## pgTAP coverage

`0021_phase5_2_interview_session_foundation_contract.sql` includes comprehensive testing for:

- Table structures, data types, and primary keys.
- Constraint violations (empty strings, invalid JSON, state/timestamp mismatches, active session uniqueness).
- Trigger-enforced immutability blocks.
- Explicit checks for table privileges and exact RLS policy definitions.
- Direct test user simulations demonstrating that `ready` state questions are masked and cross-tenant access is blocked.

## Validation evidence

- Migration 21 application: PASSED
- Database lint: PASSED
- Generated database types: SYNCHRONIZED
- pgTAP files: 15/15 PASSED
- pgTAP assertions: 480/480 PASSED
- P5.2 Test 21 assertions: 172/172 PASSED
- Formatting: PASSED
- ESLint: PASSED
- TypeScript typecheck: PASSED
- OpenAPI check: PASSED
- Jest suites: 178/178 PASSED
- Jest tests: 843/843 PASSED
- Coverage:
  - Statements: 86.41%
  - Branches: 76.44%
  - Functions: 94.13%
  - Lines: 87.35%
- Production build: PASSED
- Whitespace validation: PASSED

## Security considerations

- State-aware disclosure strictly prevents students from accessing assigned questions before they initiate the session (the `ready` state).
- The `SECURITY DEFINER` trigger functions ensure malicious clients cannot bypass immutability checks.
- Complete revocation of mutations for `authenticated` ensures no direct Supabase REST/GraphQL abuse is possible.

## P5.3/P5.4 handoff boundaries

Phase 5.3 will leverage these schema foundations to construct the Interview Configuration creation and management API routes, securely relying on the existing row-level constraints. Phase 5.4 will do the same for Session lifecycle RPCs.

## Acceptance checklist

- [x] All Phase 5.2 schema definitions match P5.1 specs exactly.
- [x] Constraints and timestamps ensure valid state progression.
- [x] Triggers are hardened in the `private` schema.
- [x] Composite ownership and immutability enforced.
- [x] Comprehensive pgTAP file validates all behaviors.
- [x] Document expanded to satisfy authorized contract requirements.
- [x] Full database validation passes.
