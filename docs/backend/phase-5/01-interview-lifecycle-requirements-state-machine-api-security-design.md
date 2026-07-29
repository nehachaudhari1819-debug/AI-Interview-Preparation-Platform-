# Phase 5.1 — Interview Lifecycle Requirements, State Machine, API Contract, and Security Design

**Status**: OFFICIALLY COMPLETED

## 1. Purpose

Define a comprehensive, implementation-ready architectural blueprint for Interview Creation and Session Lifecycle in the PrepPulse AI platform. This blueprint strictly adheres to existing security, concurrency, idempotency, and audit patterns, ensuring robust owner isolation and race-safe state transitions.

## 2. Scope

- Interview configuration (reusable intent, topics, skills)
- Interview session execution (concrete attempt with atomic configuration snapshot)
- Session-question assignment (deterministic, immutable selection of published questions)
- Strict state-machine transitions (start, pause, resume, complete)
- Concurrency-safe state locking via atomic RPCs
- Idempotency, durable transactional audit, RLS, API contracts

## 3. Explicit Exclusions

- AI evaluation and scoring (Deferred to a later formally authorized phase)
- Voice, video, and resume analysis (Deferred to a later formally authorized phase)
- Response submission and feedback (Deferred to a later formally authorized phase)
- Frontend integration
- Implementation of runtime TypeScript, migrations, OpenAPI generation, or tests (This phase is design-only)

## 4. Existing Architecture Assessment

- **Database**: No interview tables exist. Generated DB types contain only core, Question Bank, taxonomy, audit, and idempotency structures.
- **Routing**: No interview router is mounted. Runtime serves auth, user profiles, student questions, and admin Question Bank.
- **Question Source**: Student-safe selection uses `public.published_questions`. Privileged selections via RPC may use `public.questions` with a `status = 'published'` predicate. `public.question_internal_data` contains protected internal reference answers and is strictly excluded from student exposure.
- **Concurrency**: The Question Bank lifecycle relies on expected-state compare-and-set (CAS) and atomic RPCs, not generic version columns.
- **Audit**: Generic middleware is optional and fire-and-forget; durable lifecycle auditing must be strictly transactional.
- **Idempotency**: Strictly scoped by authenticated user, operation, idempotency key, and request fingerprint. Successful 2xx status/body results are cached and replayed; audit logs are intentionally bypassed on replay.

## 5. Legacy Phase 1 Proposal Reconciliation

- **POST /api/v1/interviews**: Candidate (Changed to separate Configuration creation).
- **POST /api/v1/interviews/:interviewId/start**: Candidate (Changed to Session start).
- **GET /api/v1/interviews/:interviewId/questions**: Candidate.
- **GET /api/v1/interviews/:interviewId/questions/:questionId**: Candidate.
- **POST /api/v1/interviews/:interviewId/complete**: Candidate.
- **POST /api/v1/interviews/:interviewId/responses**: Deferred to a later formally authorized phase.
- **GET /api/v1/interviews/:interviewId/responses/:responseId**: Deferred to a later formally authorized phase.
- **GET /api/v1/interviews/:interviewId/feedback**: Deferred to a later formally authorized phase.
- **GET /api/v1/admin/interviews**: Deferred to a later formally authorized phase.

## 6. Domain Vocabulary

- **Interview Configuration**: A user-owned, reusable template/intent describing target role, type, difficulty, skills, topics, question count, and time limits. Configurations remain editable for future sessions.
- **Interview Session**: A concrete execution attempt referencing a specific configuration, possessing its own lifecycle state, timestamps, pause-time accounting, and an atomic snapshot of the configuration at the time of creation.
- **Session Question**: A historically immutable assignment of a published Question Bank entity to a session.

## 7. Interview Configuration Model

- **Ownership**: `user_id = auth.uid()`
- **Attributes**: Title, Target role, Interview type, Difficulty, Skills, Topics, Question count, Time limit, `updated_at` (used for concurrency).
- **Lifecycle**: Reusable and editable. When a session is created, the configuration is atomically snapshotted into the session so existing sessions never change after configuration updates. Updates to the configuration use expected `updated_at` for concurrency protection.
- **Deletion/Archival**: Deferred to a later formally authorized phase.

## 8. Interview Session Model

- **Ownership**: `user_id = auth.uid()`
- **Attributes**: Concrete execution attempt linked to one configuration snapshot.
- **Lifecycle State**: `ready`, `in_progress`, `paused`, `completed`.
- **Timing & Accounting**: `started_at`, `paused_at`, `total_paused_seconds`, `completed_at`, `last_transition_at`. Server calculates active elapsed time. Time limits are informational only in Phase 5; the server performs no automatic expiration or state transitions based on time.
- **Immutability**: Immutable historical behavior.

## 9. Session-Question Assignment Model

- **Structure**: Persisted deterministic display order.
- **Integrity**: Source question ID mapping, capturing question text and taxonomy snapshots (immutability).
- **Security Boundary**: Must NEVER expose `reference_answer` or `evaluation_guidance`.
- **Historical Stability**: Must remain historically stable even if the original Question Bank item changes or is archived later.

## 10. Configuration Lifecycle

- Configurations do not use a `draft` or `locked` state. They remain editable continuously.
- Deletion and archival of configurations remain deferred.

## 11. Session Lifecycle States

- **ready**: Session is created and questions are securely assigned. Timer/activity not started.
- **in_progress**: Session is actively being answered.
- **paused**: Session is explicitly paused (capturing `paused_at`).
- **completed**: Session is finalized (capturing `completed_at`).

## 12. Complete State-Transition Matrix

| Current State | Target State | Action         | Auth | Idempotency | Concurrency Control        | Timestamp Updates                                   | Audit Durability      | Conflict / Invalid                                |
| ------------- | ------------ | -------------- | ---- | ----------- | -------------------------- | --------------------------------------------------- | --------------------- | ------------------------------------------------- |
| (None)        | (None)       | Update Config  | Yes  | Yes         | `updated_at` CAS           | `updated_at`                                        | Optional (Middleware) | 409 RESOURCE_CONFLICT                             |
| (None)        | ready        | Create Session | Yes  | Yes         | RPC (Max 1 active attempt) | `created_at`, `last_transition_at`                  | Mandatory (RPC)       | 409 RESOURCE_CONFLICT (Unfinished attempt exists) |
| ready         | in_progress  | Start          | Yes  | Yes         | Atomic RPC                 | `started_at`, `last_transition_at`                  | Mandatory (RPC)       | 409 RESOURCE_CONFLICT                             |
| in_progress   | paused       | Pause          | Yes  | Yes         | Atomic RPC                 | `paused_at`, `last_transition_at`                   | Mandatory (RPC)       | 409 RESOURCE_CONFLICT                             |
| paused        | in_progress  | Resume         | Yes  | Yes         | Atomic RPC                 | add to `total_paused_seconds`, `last_transition_at` | Mandatory (RPC)       | 409 RESOURCE_CONFLICT                             |
| in_progress   | completed    | Complete       | Yes  | Yes         | Atomic RPC                 | `completed_at`, `last_transition_at`                | Mandatory (RPC)       | 409 RESOURCE_CONFLICT                             |

## 13. Allowed, Forbidden, and Replay Transitions

- **Allowed**: `ready` -> `in_progress`, `in_progress` -> `paused`, `paused` -> `in_progress`, `in_progress` -> `completed`.
- **Same key while original request is running**: Returns HTTP `409` (`IDEMPOTENCY_IN_PROGRESS`).
- **Same key after original success (Replay)**: Replays original status and body. Creates no additional audit record.
- **Different key repeated valid start/pause/resume/complete (after transition already occurred)**: Returns HTTP `409` (`RESOURCE_CONFLICT`).
- **Different key invalid state jump (e.g., Start while paused, Pause while ready, Resume while in progress, Complete while paused)**: Returns HTTP `409` (`RESOURCE_CONFLICT`).
- **Every mutation after completion**: Returns HTTP `409` (`RESOURCE_CONFLICT`).
- **Stale client update config**: Returns HTTP `409` (`RESOURCE_CONFLICT`).

## 14. Ownership and Authorization Model

- Authenticated principal `auth.uid()` is the strict ownership source of truth.
- `userId` is never accepted from request bodies.
- Cross-user reads/writes are blocked via strictly scoped queries (`user_id = auth.uid()`).
- Nested resources validate ownership through parent hierarchy safely. Missing or foreign resources yield a generic `RESOURCE_NOT_FOUND` to prevent enumeration. Completed sessions cannot be reopened through ordinary mutations.
- **Active Sessions**: A strict policy of one non-completed session per configuration is enforced, while allowing multiple completed attempts.

## 15. Exact API Route Matrix

### `POST /api/v1/interviews` (Create Config)

- **Purpose**: Creates reusable interview intent.
- **Auth**: Required. Active account enforced.
- **Ownership**: Assigned to `auth.uid()`.
- **Path/Query**: None.
- **Body**: `title`, `targetRole`, `interviewTypeId`, `difficultyId`, `skillIds`, `topicIds`, `questionCount`, `timeLimitMinutes`.
- **Validation**: Strict schema constraints (no unknowns).
- **Success Status**: `201 Created`.
- **Response Fields**: Complete Interview Configuration object.
- **Auth Errors**: `401 AUTHENTICATION_REQUIRED`, `403 ACCOUNT_DISABLED`, `403 ACCOUNT_DELETED`, `404 USER_PROFILE_NOT_FOUND`, `503 SERVICE_UNAVAILABLE`.
- **Ownership/Safe-not-found**: N/A (Creation).
- **Validation Error**: `422 VALIDATION_ERROR`.
- **Idempotency Errors**: `400 IDEMPOTENCY_KEY_REQUIRED`, `400 IDEMPOTENCY_KEY_INVALID`, `409 IDEMPOTENCY_IN_PROGRESS`, `409 IDEMPOTENCY_CONFLICT`, `503 IDEMPOTENCY_SERVICE_UNAVAILABLE`.
- **Audit Action**: `INTERVIEW_CONFIG_CREATED` (Middleware).
- **Concurrency**: N/A (Insert).

### `PATCH /api/v1/interviews/:interviewId` (Update Config)

- **Purpose**: Edits intent properties before sessions snapshot them.
- **Auth**: Required. Active account enforced.
- **Ownership**: `user_id = auth.uid()`. Safe-not-found yields `404 RESOURCE_NOT_FOUND`.
- **Path/Query**: `:interviewId` (UUID).
- **Body**: Partial config properties + `expectedUpdatedAt` (ISO 8601 string) required in body. `expectedUpdatedAt` alone is invalid with `422 VALIDATION_ERROR`. Must contain at least one mutable configuration field. Empty bodies rejected.
- **Validation**: Strict schema, no unknowns.
- **Success Status**: `200 OK`.
- **Response Fields**: Complete Interview Configuration object.
- **Auth Errors**: Same as create config.
- **Validation Error**: `422 VALIDATION_ERROR`.
- **Idempotency Errors**: Same as create config.
- **Audit Action**: `INTERVIEW_CONFIG_UPDATED` (Middleware).
- **Concurrency**: `409 RESOURCE_CONFLICT` if `expectedUpdatedAt` does not match `updated_at`.

### `POST /api/v1/interviews/:interviewId/sessions` (Create Session)

- **Purpose**: Atomic session creation with configuration snapshot and question assignment.
- **Auth**: Required. Active account enforced.
- **Ownership**: Verified on parent `interviewId`. Safe-not-found `404 RESOURCE_NOT_FOUND`.
- **Path/Query**: `:interviewId` (UUID).
- **Body**: None. Reject any non-empty body with `422 VALIDATION_ERROR`.
- **Success Status**: `201 Created`.
- **Response Fields**: Complete Interview Session object (excluding questions).
- **Auth Errors**: Same as create config.
- **Validation Error**: `422 VALIDATION_ERROR`.
- **Idempotency Errors**: Same as create config.
- **Audit Action**: `INTERVIEW_SESSION_CREATED` (Mandatory, Transactional).
- **Concurrency**: RPC enforces max 1 active session. Returns `409 RESOURCE_CONFLICT` if an active session exists.
- **Shortfall Failure**: Returns `409 INSUFFICIENT_ELIGIBLE_QUESTIONS` if available pool is smaller than `questionCount`. Atomic failure, no session/audit created.

### `POST /api/v1/interviews/:interviewId/sessions/:sessionId/start`

- **Purpose**: Transitions session to `in_progress`.
- **Auth**: Required. Active account enforced.
- **Ownership**: Verified cascading `:interviewId` -> `:sessionId` -> `user_id`. `404 RESOURCE_NOT_FOUND` if mismatch or not owned.
- **Path/Query**: `:interviewId` (UUID), `:sessionId` (UUID).
- **Body**: None. Reject any non-empty body with `422 VALIDATION_ERROR`.
- **Success Status**: `200 OK`.
- **Response Fields**: Complete Interview Session object.
- **Auth Errors**: Same as create config.
- **Validation Error**: `422 VALIDATION_ERROR`.
- **Idempotency Errors**: Same as create config.
- **Audit Action**: `INTERVIEW_SESSION_STARTED` (Mandatory, Transactional).
- **Concurrency/Allowed States**: Atomic RPC locks row. Demands `status = 'ready'`. Else returns `409 RESOURCE_CONFLICT`.

### `POST /api/v1/interviews/:interviewId/sessions/:sessionId/pause`

- **Purpose**: Transitions session to `paused`, sets `paused_at`.
- **Auth/Ownership**: Same as start.
- **Path/Body**: Path same as start. Body: None. Reject any non-empty body with `422 VALIDATION_ERROR`.
- **Success Status**: `200 OK`.
- **Response Fields**: Complete Interview Session object.
- **Auth/Validation/Idempotency Errors**: Same as start.
- **Audit Action**: `INTERVIEW_SESSION_PAUSED` (Mandatory, Transactional).
- **Concurrency/Allowed States**: Demands `status = 'in_progress'`. Else `409 RESOURCE_CONFLICT`.

### `POST /api/v1/interviews/:interviewId/sessions/:sessionId/resume`

- **Purpose**: Transitions session to `in_progress`, calculates `total_paused_seconds`.
- **Auth/Ownership/Path/Body**: Same as start.
- **Success Status**: `200 OK`.
- **Response Fields**: Complete Interview Session object.
- **Auth/Validation/Idempotency Errors**: Same as start.
- **Audit Action**: `INTERVIEW_SESSION_RESUMED` (Mandatory, Transactional).
- **Concurrency/Allowed States**: Demands `status = 'paused'`. Else `409 RESOURCE_CONFLICT`.

### `POST /api/v1/interviews/:interviewId/sessions/:sessionId/complete`

- **Purpose**: Terminal state transition.
- **Auth/Ownership/Path/Body**: Same as start.
- **Success Status**: `200 OK`.
- **Response Fields**: Complete Interview Session object.
- **Auth/Validation/Idempotency Errors**: Same as start.
- **Audit Action**: `INTERVIEW_SESSION_COMPLETED` (Mandatory, Transactional).
- **Concurrency/Allowed States**: Demands `status = 'in_progress'`. Else `409 RESOURCE_CONFLICT`.

### Read Routes (`GET`)

**Shared GET Error Contract**:

- `200 OK`
- `401 AUTHENTICATION_REQUIRED`
- `403 ACCOUNT_DISABLED`, `403 ACCOUNT_DELETED`, `403 FORBIDDEN_ACCESS` (genuine authorization failure)
- `404 USER_PROFILE_NOT_FOUND`, `404 RESOURCE_NOT_FOUND`
- `422 VALIDATION_ERROR` (invalid pagination, date, or schema fields)
- `503 SERVICE_UNAVAILABLE`

#### `GET /api/v1/interviews`

- **Purpose**: List configurations.
- **Auth**: Required + Active Account.
- **Ownership**: Only returns records where `user_id = auth.uid()`.
- **Query**: `page`, `limit`, `sortBy`, `sortDir`.
- **Response**: Paginated list of Config summaries.

#### `GET /api/v1/interviews/:interviewId`

- **Purpose**: Get specific configuration.
- **Auth**: Required + Active Account.
- **Ownership**: Safe-not-found `404 RESOURCE_NOT_FOUND` if mismatch or unowned.
- **Response**: Config details.

#### `GET /api/v1/interviews/:interviewId/sessions`

- **Purpose**: List sessions for a configuration.
- **Auth/Ownership**: Cascading `user_id = auth.uid()` via `interviewId`. Safe-not-found 404.
- **Query**: `page`, `limit`, `sortBy`, `sortDir`, `status` (array of enums). Status filters support both repeated parameters (`status=ready&status=in_progress`) and comma-separated values (`status=ready,in_progress`). `createdFrom`, `createdTo`.
- **Response**: Paginated list of Session summaries.

#### `GET /api/v1/interviews/:interviewId/sessions/:sessionId`

- **Purpose**: Get session details.
- **Auth/Ownership**: Cascading parent check. Safe-not-found 404.
- **Response**: Session details.

#### `GET /api/v1/interviews/:interviewId/sessions/:sessionId/questions`

- **Purpose**: List session questions.
- **Auth/Ownership**: Cascading parent check. Safe-not-found 404.
- **Pagination**: None. Session questions are not paginated because `questionCount` is capped at 20.
- **Allowed States**: Forbidden in `ready` state (to prevent inspecting entire interview before start). Allowed in `in_progress`, `paused`, `completed`. Access in `ready` state returns `409 RESOURCE_CONFLICT`.
- **Response**: Array of Session Question summaries.

#### `GET /api/v1/interviews/:interviewId/sessions/:sessionId/questions/:sessionQuestionId`

- **Purpose**: Get specific session question details.
- **Auth/Ownership/Allowed States**: Same as list questions. Safe-not-found 404 on mismatched `sessionQuestionId`.
- **Response**: Session Question details.

## 16. Request Validation Rules

- **title**: Required. 1-100 characters.
- **targetRole**: Required. 1-100 characters.
- **interviewTypeId, difficultyId**: Required. Strict UUID format. Must map to active taxonomy entries. Inactive taxonomy entries return `422 VALIDATION_ERROR`.
- **skillIds, topicIds**: Array of valid UUIDs. `skillIds` required (min 1, max 10). `topicIds` optional (min 0, max 10). No duplicates allowed. Inactive taxonomy entries return `422 VALIDATION_ERROR`.
- **questionCount**: Required. 1-20 integers.
- **timeLimitMinutes**: Optional. 5-120 integers.
- **expectedUpdatedAt**: Required for PATCH. ISO 8601 string.
- **Pagination**: `page` (integer, min 1, default 1), `limit` (integer, min 1, max 100, default 20).
- **Sorting**: `sortBy` (`createdAt`, `updatedAt`), `sortDir` (`asc`, `desc`).
- **Status Filters**: Array of valid exact enums (`ready`, `in_progress`, `paused`, `completed`). Comma-separated or repeated query values supported.
- **Date Filters**: Inclusive ranges. `createdFrom`, `createdTo` (ISO 8601). If `createdFrom > createdTo`, returns `422 VALIDATION_ERROR`.
- **Strict schemas**: Reject unknown properties outright. Reject empty PATCH bodies. Reject any body on `POST` for sessions and lifecycle routes. Return `422 VALIDATION_ERROR`.

## 17. Response-Envelope Contracts

All responses use the generic `{ success: true, data: { ... }, meta: { requestId } }`.
Paginated lists include `meta: { totalItems, totalPages, currentPage, limit, hasNextPage, hasPreviousPage }`.

### Exact Output Schemas

- **Interview Configuration**: `id`, `title`, `targetRole`, `interviewType` (object: `{ id, name }`), `difficulty` (object: `{ id, name }`), `skills` (array of objects: `{ id, name }`), `topics` (array of objects: `{ id, name }`), `questionCount`, `timeLimitMinutes`, `createdAt`, `updatedAt`.
- **Interview Session**: `id`, `interviewId`, `status`, `configSnapshot` (exact schema below, without versions), `startedAt`, `pausedAt`, `totalPausedSeconds`, `completedAt`, `lastTransitionAt`, `createdAt`, `updatedAt`.
- **Session Question**: `id`, `sessionId`, `displayOrder`, `questionTextSnapshot`, `taxonomySnapshot` (exact schema below, without versions), `createdAt`.
- **Exclusions**: `user_id`, database constraint names, `reference_answer`, `evaluation_guidance`, internal audit/replay IDs, and snapshot versions are strictly omitted from student-facing responses.

## 18. Exact Error-Code Matrix

- `400`: `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_INVALID`, malformed request/header failures.
- `401`: `AUTHENTICATION_REQUIRED`.
- `403`: `ACCOUNT_DISABLED`, `ACCOUNT_DELETED`, `FORBIDDEN_ACCESS`.
- `404`: `USER_PROFILE_NOT_FOUND`, `RESOURCE_NOT_FOUND`.
- `409`: `RESOURCE_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `INSUFFICIENT_ELIGIBLE_QUESTIONS`.
- `422`: `VALIDATION_ERROR`.
- `503`: `SERVICE_UNAVAILABLE`, `IDEMPOTENCY_SERVICE_UNAVAILABLE`.

## 19. Idempotency Design

Mandatory `Idempotency-Key` requirement for mutations:

- `student_create_interview_config`
- `student_update_interview_config`
- `student_create_interview_session`
- `student_start_interview_session`
- `student_pause_interview_session`
- `student_resume_interview_session`
- `student_complete_interview_session`

## 20. Replay Behavior

- Identical fingerprint + key + user + operation: Cached 2xx response replay. Original body returned; new audit logs are entirely suppressed.
- `409 IDEMPOTENCY_IN_PROGRESS` if the same key is received while the original request is running.

## 21. Concurrency and Atomicity Design

- **Algorithm**: Atomic PostgreSQL RPC with row-level locks.
- **Flow**: RPC locks the owned session row using `FOR UPDATE`. It validates the expected current status. It performs the transition and timestamp updates. It inserts the durable audit record. It returns the updated session. The entire operation commits or rolls back atomically.
- **Mismatch**: A state mismatch maps cleanly to a `409 RESOURCE_CONFLICT`.

## 22. Audit Durability Design

- **Mandatory Durable Audit (RPC)**: `INTERVIEW_SESSION_CREATED`, `INTERVIEW_SESSION_STARTED`, `INTERVIEW_SESSION_PAUSED`, `INTERVIEW_SESSION_RESUMED`, `INTERVIEW_SESSION_COMPLETED`. All inserted strictly within the state-machine RPC transaction and rolled back if the mutation fails.
- **Mandatory Durable Audit Payload Fields**: For each session lifecycle event, the audit record must map exactly to the existing `audit_logs` table:
  - `actorUserId` -> `actor_user_id`
  - `resourceType` -> `resource_type`
  - `resourceId` -> `resource_id`
  - `action` -> `action`
  - `requestId` -> `request_id`
  - `occurredAt` -> `created_at` generated by database `now()`

  **metadata**:
  - `interviewId`
  - `previousStatus`
  - `nextStatus`
  - `questionCount`, when applicable
  - `configSnapshotVersion`, when applicable

  Also state:
  - `actor_type` = `'user'`
  - `created_at` uses database time
  - `metadata` contains safe fields only

- **Explicit Prohibitions**: The following must NEVER be stored in the audit record: question text, reference answers, evaluation guidance, tokens, authorization headers, raw request bodies.
- **Optional Operational Audit (Middleware)**: `INTERVIEW_CONFIG_CREATED`, `INTERVIEW_CONFIG_UPDATED`.

## 23. Proposed Database Schema

### `interviews` (Configuration)

- `id` (uuid, PK, NOT NULL, default `gen_random_uuid()`)
- `user_id` (uuid, FK `users`, `ON DELETE RESTRICT`, NOT NULL)
- `title` (varchar 100, NOT NULL), `target_role` (varchar 100, NOT NULL)
- `interview_type_id` (uuid, FK `question_interview_types`, `ON DELETE RESTRICT`, NOT NULL), `difficulty_id` (uuid, FK `question_difficulties`, `ON DELETE RESTRICT`, NOT NULL)
- `question_count` (integer, NOT NULL), `time_limit_minutes` (integer, nullable)
- `created_at` (timestamptz, NOT NULL, default `now()`), `updated_at` (timestamptz, NOT NULL, default `now()`)

### `interview_skill_mappings`

- PRIMARY KEY (`interview_id`, `skill_id`)
- `interview_id` (uuid, FK `interviews`, `ON DELETE RESTRICT`, NOT NULL)
- `skill_id` (uuid, FK `question_skills(id)`, `ON DELETE RESTRICT`, NOT NULL)
- `created_at` (timestamptz, NOT NULL, default `now()`)

### `interview_topic_mappings`

- PRIMARY KEY (`interview_id`, `topic_id`)
- `interview_id` (uuid, FK `interviews`, `ON DELETE RESTRICT`, NOT NULL)
- `topic_id` (uuid, FK `question_topics(id)`, `ON DELETE RESTRICT`, NOT NULL)
- `created_at` (timestamptz, NOT NULL, default `now()`)

### `interview_sessions`

- `id` (uuid, PK, NOT NULL, default `gen_random_uuid()`)
- `interview_id` (uuid, FK `interviews`, `ON DELETE RESTRICT`, NOT NULL)
- `user_id` (uuid, FK `users`, `ON DELETE RESTRICT`, NOT NULL)
- `status` (`ready`, `in_progress`, `paused`, `completed`, NOT NULL, default `'ready'`)
- `config_snapshot` (jsonb, NOT NULL)
- `config_snapshot_version` (integer, NOT NULL, default 1)
- `started_at` (timestamptz, nullable), `paused_at` (timestamptz, nullable), `total_paused_seconds` (integer, NOT NULL, default 0), `completed_at` (timestamptz, nullable), `last_transition_at` (timestamptz, NOT NULL, default `now()`)
- `created_at` (timestamptz, NOT NULL, default `now()`), `updated_at` (timestamptz, NOT NULL, default `now()`)

### `interview_session_questions`

- `id` (uuid, PK, NOT NULL, default `gen_random_uuid()`)
- `session_id` (uuid, FK `interview_sessions`, `ON DELETE RESTRICT`, NOT NULL)
- `question_id` (uuid, FK `questions`, `ON DELETE RESTRICT`, NOT NULL)
- `display_order` (integer, NOT NULL)
- `question_text_snapshot` (text, NOT NULL)
- `taxonomy_snapshot` (jsonb, NOT NULL)
- `question_snapshot_version` (integer, NOT NULL, default 1)
- `created_at` (timestamptz, NOT NULL, default `now()`)

## 24. Snapshot Schemas

**config_snapshot**:
`{ "title": "...", "targetRole": "...", "interviewType": { "id": "UUID", "name": "..." }, "difficulty": { "id": "UUID", "name": "..." }, "skills": [{ "id": "UUID", "name": "..." }], "topics": [{ "id": "UUID", "name": "..." }], "questionCount": 5, "timeLimitMinutes": 30, "capturedAt": "ISO8601" }`

**taxonomy_snapshot**:
`{ "category": { "id": "UUID", "name": "..." }, "difficulty": { "id": "UUID", "name": "..." }, "interviewType": { "id": "UUID", "name": "..." }, "skills": [{ "id": "UUID", "name": "..." }], "topics": [{ "id": "UUID", "name": "..." }], "sourceQuestionId": "UUID", "capturedAt": "ISO8601" }`
_(Strictly excludes `referenceAnswer` and `evaluationGuidance`. Snapshot versions are NOT stored in the JSON, they are stored in the database columns only, and are omitted from student API responses)._

## 25. Proposed Constraints and Indexes

- Unique: `(session_id, display_order)`.
- Unique: `(session_id, question_id)`.
- Active Session Uniqueness: Partial unique index on `interview_id` WHERE `status != 'completed'` to enforce one active attempt.
- Indexes: `user_id`, `interview_id`, `session_id`.
- Check constraints:
  - `status` IN ('ready', 'in_progress', 'paused', 'completed')
  - `display_order > 0`
  - `question_count BETWEEN 1 AND 20`
  - `time_limit_minutes BETWEEN 5 AND 120`
  - `total_paused_seconds >= 0`
  - `started_at IS NULL` when `status = 'ready'`
  - `started_at IS NOT NULL` when `status IN ('in_progress', 'paused', 'completed')`
  - `paused_at IS NOT NULL` when `status = 'paused'`
  - `paused_at IS NULL` when `status != 'paused'`
  - `completed_at IS NOT NULL` when `status = 'completed'`
  - `completed_at IS NULL` when `status != 'completed'`
  - `completed_at >= started_at`
  - `last_transition_at >= created_at`
- Database-controlled `updated_at`: `updated_at` must be controlled by a database trigger/RPC (not updated directly by queries to arbitrary values, ensuring it only goes forward).
- Timestamps must use database time exclusively (e.g. `now()`).

## 26. Proposed RLS and Privilege Design

- **Active Account Enforcement**: Every student interview RLS read policy must require both resource ownership AND that the authenticated user account is active. Direct Supabase reads by disabled/deleted users must return zero rows, while API access uses the established account error contracts.

- **`interviews`**: `TO authenticated USING (user_id = (SELECT auth.uid()) AND (SELECT public.get_current_account_access_state()) = 'active') WITH CHECK (user_id = (SELECT auth.uid()))`
- **`interview_sessions`**: `TO authenticated USING (user_id = (SELECT auth.uid()) AND (SELECT public.get_current_account_access_state()) = 'active') WITH CHECK (user_id = (SELECT auth.uid()))`
- **`interview_skill_mappings` / `interview_topic_mappings`**: `TO authenticated USING (interview_id IN (SELECT id FROM interviews WHERE user_id = (SELECT auth.uid())) AND (SELECT public.get_current_account_access_state()) = 'active') WITH CHECK (interview_id IN (SELECT id FROM interviews WHERE user_id = (SELECT auth.uid())))`
- **`interview_session_questions`**: `TO authenticated USING ((SELECT public.get_current_account_access_state()) = 'active' AND EXISTS (SELECT 1 FROM public.interview_sessions AS session WHERE session.id = interview_session_questions.session_id AND session.user_id = (SELECT auth.uid()) AND session.status IN ('in_progress', 'paused', 'completed'))) WITH CHECK (session_id IN (SELECT id FROM interview_sessions WHERE user_id = (SELECT auth.uid())))`. This state-aware SELECT policy strictly prevents ready-state question disclosure at the database layer.
- **Privileges**: Revoke default `PUBLIC` access. Direct `SELECT` granted to authenticated. `INSERT`, `UPDATE`, `DELETE` permitted only through `SECURITY DEFINER` RPCs (Default-deny table mutations).
- **SECURITY DEFINER Hardening**:
  - Fully qualified relation names (e.g. `public.interview_sessions`).
  - Restricted search path (`SET search_path = ''`).
  - Revoked `PUBLIC` execution (`REVOKE ALL ON FUNCTION ... FROM PUBLIC`).
  - Explicit execution grant (`GRANT EXECUTE ON FUNCTION ... TO authenticated`).
  - Authenticated identity verification (`auth.uid() IS NOT NULL`).
  - No client-provided owner (`v_user_id := auth.uid()`).
  - Atomic audit insertion within the RPC.
  - No access to `question_internal_data`.

## 27. Question Bank Integration

- **Selection**: Atomic session creation RPC explicitly limits selection to `public.published_questions`.
- **Deterministic Algorithm**: `ORDER BY md5(q.id::text || ':' || v_session_id::text) ASC, q.id ASC`. This ensures deterministic order for a given session, prevents duplicate question IDs, persists that order via assignment, and uses an unambiguous final tie-breaker.
- **Exact Filter Semantics**:
  - `interview_type_id`: Exact match.
  - `difficulty_id`: Exact match.
  - `skill_ids`: ALL selected skills must match the question (subset of question skills).
  - `topic_ids`: ALL selected topics must match the question (subset of question topics).
  - `targetRole`: Informational only (not used to filter questions).
  - Inactive taxonomy behavior: Question taxonomy must be active at the time of session creation. If a configuration referenced taxonomy items that later became inactive, session creation MUST return HTTP `409 RESOURCE_CONFLICT`. The transaction must create no session, no assignments, and no audit record.
- **Shortfall Failure**: If eligible unique published questions matching all exact configuration taxonomy filters are fewer than `questionCount`, fail atomically. Return HTTP `409 INSUFFICIENT_ELIGIBLE_QUESTIONS`. No configuration locks or mutations, no assignments, no audit record created.

## 28. Information-Disclosure Boundaries

- **Strict Exclusion**: `public.question_internal_data` (`reference_answer`, `evaluation_guidance`) is never joined or queried.
- **Nested Resource Obfuscation**: Resource mismatches return `404 RESOURCE_NOT_FOUND`.

## 29. Security Threat Model

| Threat                     | Scenario                                           | Control                                                                          | Enforcement Layer      | Test                                             |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------ |
| Cross-user reads           | User A requests User B's session                   | `user_id = auth.uid()`                                                           | Database RLS           | Verify 404                                       |
| Nested ID Mismatch         | Valid session ID passed with wrong interview ID    | Cascading parent ownership check                                                 | RPC / Middleware       | Verify 404                                       |
| Ready-state disclosure     | Student queries Supabase for ready questions       | State-aware RLS policy on `interview_session_questions`                          | Database RLS           | Verify 0 rows / empty response                   |
| Invalid Transition         | Client sends Complete to a Ready session           | Atomic RPC CAS validation                                                        | Database RPC           | Verify 409                                       |
| Concurrent transitions     | Different-key double-click Start                   | Atomic Row lock (`FOR UPDATE`)                                                   | Database RPC           | Verify 409                                       |
| Replay Abuse               | Same-key double-click Start                        | Exact fingerprint check, Cached 200 replay                                       | Idempotency Middleware | Verify 200 (no DB execution)                     |
| In-progress same-key       | Same key sent while original running               | Lock/state check in idempotency cache                                            | Idempotency Middleware | Verify 409 `IDEMPOTENCY_IN_PROGRESS`             |
| Active-Session Limit       | Concurrent Session Creates                         | Partial unique index (`status != 'completed'`)                                   | Database Constraints   | Verify 409                                       |
| Evaluation Leakage         | Student accesses `question_internal_data`          | Excluded from view/RPC joins                                                     | Database RPC / API     | Verify response schema                           |
| Stale Token Usage          | Suspended user attempts start                      | `requireActiveAccount` middleware                                                | API Middleware         | Verify 401/403                                   |
| Mass Assignment            | Client injects `started_at` in PATCH               | Strict Zod `strict()` rejection                                                  | API Validation         | Verify 422                                       |
| Question archival          | Question is archived during active session         | Snapshots preserve history; `ON DELETE RESTRICT` protects only physical deletion | Database Constraints   | Verify DB blocks delete, snapshots preserve data |
| Config update post-session | Client updates config to change session intent     | Atomic snapshot on session creation                                              | Database RPC           | Verify session uses v1 snapshot                  |
| Audit loss / Rollback      | DB fails during question assignment                | Audit logs inserted strictly inside RPC tx                                       | Database RPC           | Verify no audit if session fails                 |
| Service-role misuse        | API bypasses RLS                                   | Ensure `user_id` mapped via `auth.uid()` inside RPC                              | Database RPC           | Verify `auth.uid()` enforcement                  |
| Excessive pagination       | `limit=1000`                                       | Strict Zod validation limit                                                      | API Validation         | Verify 422                                       |
| Invalid date filters       | `createdFrom > createdTo`                          | Custom Zod refinement                                                            | API Validation         | Verify 422                                       |
| Mapping table RLS          | User A reads User B's mappings                     | Parent `interview_id` subquery RLS                                               | Database RLS           | Verify 404 / 0 rows                              |
| Direct table mutation      | Client attempts `INSERT` into `interview_sessions` | Revoked `INSERT`, granted only to RPC                                            | Database Grants        | Verify permission denied                         |

## 30. Unit-Test Strategy

- Zod schema validations for config inputs, empty PATCH bodies, unknown query parameters, and invalid date filters.
- Controller error code mapping and formatting.

## 31. Repository-Integration-Test Strategy

- State transitions via repository methods.
- Atomic collision verification (forcing CAS conflicts, invalid state transitions, stale client updates, failure rollback after partial assignment).

## 32. E2E-Test Strategy

- Full integration of Auth -> Config -> Session -> Start -> Pause -> Resume -> Complete.
- Idempotency coverage across full stack (missing key, duplicate key, replay verification, `IDEMPOTENCY_IN_PROGRESS`).
- Insufficient questions handling (atomic failure).
- Ensure questions cannot be fetched in `ready` state (returns 409 API, 0 rows DB).

## 33. Security-Test Strategy

- Intentional cross-tenant UUID swaps (proving 404 enumeration prevention).
- Validating constraint enforcement inside the RPC boundaries (proving `SECURITY DEFINER` boundary is unbreachable, search paths are restricted).
- Direct Supabase SDK access simulating malicious student attempts to read ready-state questions.

## 34. Database-Test Strategy

- pgTAP verification for RLS policies, table privileges, foreign key restricted deletes, and atomic RPC transaction commits/rollbacks.
- pgTAP tests confirming state-aware SELECT policy on `interview_session_questions`.

## 35. OpenAPI Implications

- Strict typings for `InterviewConfigResponse` and `InterviewSessionResponse`.
- Mapping `400`, `401`, `403`, `404`, `409`, `422`, and `503` schemas precisely to each route.

## 36. Implementation Rollout Sequence

- **P5.2** — Interview and Session Database Schema, Constraints and RLS Foundation
- **P5.3** — Interview Creation, Configuration and History APIs
- **P5.4** — Interview Session Lifecycle APIs
- **P5.5** — Ownership, Audit, Idempotency, Concurrency and Security Hardening
- **P5.6** — OpenAPI Contract, Integration Readiness and Final Phase-5 Closure

## 37. Acceptance Criteria (P5.1 Architecture Checklist)

- [x] All domain decisions (separation of Config vs Session) are frozen.
- [x] All 13 API contracts are complete with precise status, error, and validation boundaries.
- [x] Every lifecycle, concurrency, and replay outcome is exactly defined.
- [x] Schema columns, table-specific RLS policies, and check constraints are exact.
- [x] Snapshot schemas are exactly defined with versions.
- [x] Question selection is fully deterministic (`ORDER BY md5(...)`).
- [x] Foreign keys use `ON DELETE RESTRICT` for history preservation.
- [x] No runtime or SQL implementation was generated (design only).
- [x] P5.2 remains safely gated behind formal approval.

## 38. Deferred Decisions

- Abandoned session timeout reaping mechanism.
- Specific AI evaluation models.
- Handling of response submissions and feedback (Deferred to a later formally authorized phase).
