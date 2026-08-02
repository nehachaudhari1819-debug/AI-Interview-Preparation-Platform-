# Phase 6.2: Interview Answer, Evaluation & Result Database Foundation

## 1. Overview
This document officially specifies the schema, privileges, and immutable constraints for the Phase 6 AI Interview Evaluation tables: `interview_session_answers`, `interview_answer_evaluations`, and `interview_session_results`.

## 2. P0015 Reservation and Worker Mapping
The reserved `P0015` SQLSTATE maps specifically to `WORKER_VALIDATION_FAILED` (HTTP 500: `OPERATION_FAILED`), indicating an internal/private database failure. Raw validation traces and trigger exceptions are sanitized before API presentation, concealing execution errors from public consumers.

## 3. Ownership Chains & Row Level Security
All three tables define deep ownership paths:
- Foreign keys explicitly restrict cascading updates/deletes (`ON UPDATE RESTRICT ON DELETE RESTRICT`) through the ownership chain: `user_id` -> `interview_id` -> `session_id` -> `session_question_id`.
- Complete RLS lockdown: `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`.
- `REVOKE ALL ON TABLE ... FROM PUBLIC, anon, authenticated, service_role`. There are no direct operational privileges.

## 4. Exact State Transitions and Identifiers
### Answers
- **INSERT**: `draft` and `skipped` states are allowed. `finalized` is prohibited.
- **UPDATE**:
  - `draft` -> `draft` and `draft` -> `finalized` are allowed.
  - `draft` -> `skipped` is prohibited (`P0003`).
  - `finalized` and `skipped` remain irreversibly terminal (`P0013` and `P0014` respectively).
  - Every valid mutable update must explicitly increment `version` by exactly 1 (`P0003`).
- Must have parent session strictly in `in_progress` state (`P0011`).

### Evaluations
- Follows the strictly defined lifecycle tracking `attempt_count` (0-3).
- **INSERT**: Must strictly be `pending` (for a finalized answer) or `skipped` (for a skipped answer). `processing`, `completed`, and `failed` are prohibited.
- **UPDATE**:
  - Valid transitions: `pending` -> `processing`, `processing` -> `processing` (lease reclamation), `processing` -> `completed`, `processing` -> `failed`.
  - Terminal states (`completed`, `failed`, `skipped`) cannot be updated.
  - Any invalid transition raises `P0003`.
- **Cross-Table Invariants**: An evaluation in `skipped` state rigidly mandates its linked parent answer is also `skipped`. A non-skipped evaluation strictly mandates its parent answer is `finalized`.

### Results
- **INSERT**: Must strictly be `pending`. `partial`, `ready`, and `failed` are prohibited.
- **UPDATE**:
  - Valid transitions: `pending` -> `pending`, `partial`, `ready`, `failed`. `partial` -> `partial`, `ready`, `failed`.
  - `partial` -> `pending` is strictly prohibited.
  - `ready` and `failed` remain completely terminal and immutable.
  - Invalid transitions raise `P0003`.

### Immutable Generation Identifiers
- `evaluation_version` (evaluations) and `publication_version` (results) represent single-generation identifiers.
- They, alongside all core identifiers (`id`, `user_id`, `created_at`, `response_type`), are strictly frozen against modification on every `UPDATE` request (`P0003`).

## 5. Sanitized Read RPCs
Data is encapsulated via explicit `SECURITY DEFINER` read wrappers operating with `search_path = ''`. Inactive accounts are safely blocked (`P0001`). If a row does not exist or the caller lacks ownership, the RPC securely conceals existence by returning `P0002` (RESOURCE_NOT_FOUND).

### `student_list_session_answers(uuid, uuid)`
- **Returns**: `id`, `session_question_id`, `response_type`, `text_response`, `code_response`, `status`, `version`, `finalized_at`, `skipped_at`, `created_at`, `updated_at`.
- **Ordering**: Sorted ascending by `display_order`, then `session_question_id`.
- **Grants**: `EXECUTE` strictly granted to `authenticated` and revoked from all other operational roles.

### `student_get_session_answer(uuid, uuid, uuid)`
- **Returns**: Exactly matches the public columns returned by `student_list_session_answers`, scoped to a single `session_question_id`.
- **Grants**: `EXECUTE` strictly granted to `authenticated`.

### `student_get_answer_evaluation(uuid, uuid, uuid)`
- **Returns**: `id`, `answer_id`, `status`, `evaluation_version`, `rubric_version`, `prompt_version`, `scoring_version`, `failure_code`, `attempt_count`, `started_at`, `completed_at`, `failed_at`, `overall_score`, `dimension_scores`, `strengths`, `improvement_areas`, `student_feedback`, `created_at`, `updated_at`.
- **Concealment**: Safely excludes internal execution artifacts (`provider`, `model`, `lease_token`, `lease_expires_at`, `evaluator_metadata`).
- **Ordering**: Evaluates the latest generated evaluation (`ORDER BY evaluation_version DESC LIMIT 1`).
- **Grants**: `EXECUTE` strictly granted to `authenticated`.

### `student_get_latest_session_result(uuid, uuid)`
- **Returns**: `id`, `status`, `overall_score`, `score_breakdown`, `strengths`, `improvement_summary`, `scoring_version`, `publication_version`, `generated_at`, `created_at`, `updated_at`.
- **Ordering**: Returns the latest generated publication (`ORDER BY publication_version DESC LIMIT 1`).
- **Grants**: `EXECUTE` strictly granted to `authenticated`.

## 6. Future Scope & Deferred Responsibilities
- **P6.3** strictly owns all answer mutation logic (drafting/submitting) and session-completion API implementations.
- **P6.4** strictly owns deterministic worker orchestration, active leasing, robust evaluator integration, and result publication.
- **Test 25**: Implements the pgTAP test cases verifying the exact states, bounds, and immutability schemas formalized in this foundation.
