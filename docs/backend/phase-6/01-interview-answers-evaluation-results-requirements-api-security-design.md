# Phase 6.1: Interview Answers, Evaluation, Scoring, Results, and Feedback Architecture

## 1. Purpose and scope

The purpose of Phase 6 is to implement the core evaluation loop of the AI Interview Preparation Platform. This encompasses the student answering questions, the system freezing answers upon session completion, the asynchronous AI evaluation of those answers, and the deterministic generation of per-question scores and overall session results.

The scope of P6.1 covers the comprehensive design of the API contracts, database schema, security boundaries, state machines, strict scoring math, and concurrency controls necessary to execute this phase safely and securely.

## 2. Existing Phase 5 dependencies

This phase builds securely on top of the Phase 5 invariants:

- **Idempotency**: Leveraging the existing `Idempotency-Key` and `idempotency_records` system for safely replaying operations.
- **Audit**: Utilizing `audit_log` records to trace all state transitions.
- **Concurrency**: Employing `pg_try_advisory_xact_lock` using the exact same existing Phase 5 session advisory-lock formula or helper to ensure race conditions do not occur (e.g. no two different formulas can exist).
- **Ownership/RLS**: Continuing strict tenant-isolation through robust Supabase Row Level Security (RLS) policies.

## 3. Functional requirements

- **Answer retrieval**: Students must be able to retrieve all answers for a specific interview session, or a specific answer for a given session question.
- **Draft answer creation/updates**: Students can incrementally save drafts of text and code answers.
- **Answer finalization**: Students can finalize an answer, preventing further edits and marking it ready for evaluation.
- **Session completion interaction**: Completing a session automatically finalizes all draft answers, records unanswered questions as skipped, and makes the session eligible for evaluation.
- **Evaluation**: Asynchronous processing pipeline that grades finalized answers against a rubric, utilizing a versioned scoring model.
- **Scoring**: Deterministic calculation of 0-100 scores per question and an aggregated 0-100 score for the entire session.
- **Results and feedback**: Students can access their final scores, constructive feedback, strengths, and improvement areas safely through the API.

## 4. Non-functional requirements

- **Immutable finalization**: Finalized and skipped answers must be completely immutable.
- **Optimistic Concurrency**: Draft updates must enforce stale-write prevention using version numbers.
- **Transactional integrity**: All answer mutations and session transitions must be fully atomic.
- **Duplicate-worker prevention**: Evaluation queues must utilize lease-based mechanisms to prevent duplicate AI invocations.

## 5. Non-goals

- Video, audio, or body-language analysis.
- Live interviewer streaming.
- Execution of untrusted code snippets in Phase 6.
- Direct exposure of raw AI provider responses or hidden rubrics to students.

## 6. Terminology

- **Draft Answer**: An answer currently being edited by a student.
- **Finalized Answer**: An immutable answer successfully submitted.
- **Skipped Answer**: A session question that remained unanswered upon session completion.
- **Evaluation Lease**: A temporary 5-minute processing lease acquired by a worker to process an AI evaluation safely.
- **Result Publication**: The final state when an interview session has been fully scored.

## 7. Domain entities

- `interview_session_answers`: Tracks the student's response to a specific session question.
- `interview_answer_evaluations`: Tracks the asynchronous AI grading job and output for a finalized answer.
- `interview_session_results`: Tracks the aggregated 0-100 score and overarching feedback for the entire session.

## 8. Domain invariants

1. One answer resource per session question.
2. The answer must belong to exactly one session, exactly one session question, and exactly one authenticated student.
3. Valid ownership chain: The database model must describe concrete ownership-chain enforcement using composite foreign keys linking `user_id`, `interview_id`, `session_id`, and `session_question_id` to strictly prove they belong to the same chain.
4. Answer creation/updates are allowed _only_ while the session is `in_progress`. The `responseType` cannot be changed after initial draft creation.
5. Paused, completed, or terminal sessions cannot accept answer mutations.
6. A finalized answer is immutable.
7. A skipped answer is terminal.
8. Storage model for skipped answers vs finalized/drafts is strict:
   - `draft`/`finalized`: `response_type` is text or code. Exactly one matching content payload is present. `finalized_at` is required only for `finalized`.
   - `skipped`: `response_type` is NULL, `text_response` is NULL, `code_response` is NULL, `skipped_at` is NOT NULL, `finalized_at` is NULL.
9. Strict size limits on text (max 10,000 chars) and code answers (max 50,000 chars, with 10,000 char explanation) must be enforced. Empty answers are rejected with a 400 Bad Request. Max feedback string length is 2000 chars, and max array length for strengths/improvements is 5 items.
10. The client cannot set owner ID, session ID (outside route), status, scores, audit fields, version fields, or timestamps.
11. Ownership failures must be concealed as resource-not-found (`404`) responses.
12. All writes must be transactional.
13. Retryable writes must be idempotent.
14. Stale-write overwrites must be prevented via optimistic concurrency versions.
15. Audit records are append-only and refer to `idempotency_record_id`, not the raw idempotency key.
16. Evaluations must be versioned.
17. One evaluation version must not create duplicate published results.
18. Students can read _only_ their own resources.
19. Service-role access must not become a public bypass path.

## 9. State Machines

### A. Answer state machine

**States**: `draft`, `finalized`, `skipped`
**Allowed Transitions**:

- `[No Answer]` → `draft` (Student explicitly saves draft, returns 201 Created)
- `draft` → `draft` (Student updates draft, version increments by 1, returns 200 OK)
- `draft` → `finalized` (Student explicitly finalizes answer, returns 200 OK)
- `[No Answer]` → `skipped` (Upon session completion, missing answers become skipped)
- `draft` → `finalized` (Upon session completion, existing drafts are automatically finalized)

**Forbidden Transitions**:

- `[No Answer]` → `finalized` (Direct finalization without a draft is unsupported)
- `draft` → `skipped` (Drafts MUST be finalized upon completion, never skipped)
- `finalized` → `draft`
- `finalized` → `skipped`
- `skipped` → `draft`
- `skipped` → `finalized`
- Any mutation after session completion.

### B. Evaluation state machine

**States**: `pending`, `processing`, `completed`, `failed`, `skipped`
**Behaviors**:

- Max attempts: 3.
- Lease duration: 5 minutes.
- Evaluated ONLY for `finalized` answers. `skipped` answers receive a `skipped` evaluation.

**Transitions**:

- `[No Evaluation]` → `pending` (Created upon session completion for finalized answers)
- `[No Evaluation]` → `skipped` (Created upon session completion for skipped answers)
- `pending` → `processing` (Worker acquires lease, increments attempt count, sets lease expiry)
- `processing` → `completed` (Worker succeeds, records score)
- `processing` → `pending` (Worker fails retryably OR lease expires and attempts < 3)
- `processing` → `failed` (Worker fails critically OR attempts == 3)

### C. Result publication state

**States**: `pending`, `partial`, `ready`, `failed`
**Transitions**:

- `[No Result]` → `pending` (Created upon session completion)
- `pending` → `partial` (At least one evaluation completes, others pending)
- `partial` / `pending` → `ready` (All evaluations reach `completed` or `skipped`)
- `partial` / `pending` → `failed` (At least one evaluation reaches `failed`)

## 10. Scoring Model

- **Text-answer dimensions**:
  - `technicalAccuracy` (Weight: 30)
  - `relevance` (Weight: 20)
  - `completeness` (Weight: 20)
  - `clarity` (Weight: 15)
  - `technicalDepth` (Weight: 15)
- **Code-answer dimensions**:
  - `correctness` (Weight: 40)
  - `approach` (Weight: 20)
  - `codeQuality` (Weight: 15)
  - `complexity` (Weight: 15)
  - `explanationClarity` (Weight: 10)
- **Dimension Ranges**: Each dimension is evaluated on an exact `0-100` scale.
- **Weighted-score Calculation**: The per-question score is the sum of `(dimension_score * dimension_weight) / 100`.
- **Intermediate Precision**: Intermediate dimension scores and aggregate calculations use PostgreSQL `NUMERIC` types to retain exact decimal precision.
- **Half-up Rounding Point**: Rounding (`Round Half Up`) is performed mathematically exactly once at the final worker layer before storing the integer final question score, and similarly for the final session aggregate score.
- **Validation**: The JSON payload for `dimension_scores` must strictly conform to these exact dimension keys. The API/worker strictly validates this structure before processing or persistence.
- **Aggregation Formula**: `round(SUM(completed_question_scores) / total_questions)`.
- **Skipped Questions**: A skipped question counts against the total denominator and inherently provides a score of `0` for the aggregation formula, though its evaluation row is marked `skipped` with a `null` score.
- **Terminal Failures**: If an evaluation reaches `failed`, the session result becomes `failed`. It does not fall back to a `0` score.

## 11. Proposed database model

**Table: interview_session_answers**

- `id`: uuid, pk
- `user_id`: uuid, fk, not null
- `interview_id`: uuid, fk, not null
- `session_id`: uuid, fk, not null
- `session_question_id`: uuid, fk, not null, unique
- `response_type`: text, nullable, check ('text', 'code')
- `text_response`: text, nullable, check (length <= 10000)
- `code_response`: jsonb, nullable (schema: { source: string (1-50000 chars), language: "python" | "javascript" | "typescript" | "java" | "cpp" | "go" | "rust", explanation: string (1-10000 chars) })
- `status`: text, not null, check ('draft', 'finalized', 'skipped')
- `version`: int, not null, default 1, check (version > 0)
- `finalized_at`: timestamptz, nullable
- `skipped_at`: timestamptz, nullable
- `created_at`: timestamptz, not null
- `updated_at`: timestamptz, not null
  _(Composite foreign keys will explicitly enforce that the user_id, interview_id, session_id, and session_question_id refer exactly to the matching chained records in `interview_session_questions` and `interview_sessions`.)_

**Table: interview_answer_evaluations**

- `id`: uuid, pk
- `user_id`: uuid, fk, not null
- `session_id`: uuid, fk, not null
- `session_question_id`: uuid, fk, not null
- `answer_id`: uuid, fk, not null
- `status`: text, not null, check ('pending', 'processing', 'completed', 'failed', 'skipped')
- `evaluation_version`: int, not null
- `rubric_version`: int, not null
- `prompt_version`: int, not null
- `provider`: text, nullable (null if skipped)
- `model`: text, nullable (null if skipped)
- `attempt_count`: int, not null, default 0, check (attempt_count <= 3)
- `lease_token`: uuid, nullable
- `lease_expires_at`: timestamptz, nullable
- `started_at`: timestamptz, nullable
- `completed_at`: timestamptz, nullable
- `failed_at`: timestamptz, nullable
- `failure_code`: text, nullable
- `overall_score`: int, nullable, check (overall_score >= 0 AND overall_score <= 100)
- `dimension_scores`: jsonb, nullable
- `strengths`: jsonb, nullable (array of strings, max 5)
- `improvement_areas`: jsonb, nullable (array of strings, max 5)
- `student_feedback`: text, nullable (length <= 2000)
- `evaluator_metadata`: jsonb, nullable
- `created_at`: timestamptz, not null
- `updated_at`: timestamptz, not null
  _(Unique constraint on `answer_id`, `evaluation_version`)_

**Table: interview_session_results**

- `id`: uuid, pk
- `user_id`: uuid, fk, not null
- `session_id`: uuid, fk, not null
- `status`: text, not null, check ('pending', 'partial', 'ready', 'failed')
- `overall_score`: int, nullable, check (overall_score >= 0 AND overall_score <= 100)
- `score_breakdown`: jsonb, nullable (Schema: Record<uuid (sessionQuestionId), number>)
- `strengths`: jsonb, nullable (array of strings, max 5)
- `improvement_summary`: text, nullable (length <= 2000)
- `scoring_version`: int, not null
- `publication_version`: int, not null, default 1
- `generated_at`: timestamptz, nullable
- `created_at`: timestamptz, not null
- `updated_at`: timestamptz, not null
  _(Unique constraint on `session_id`, `publication_version`. The highest publication version is considered the currently published active result.)_

## 12. Security and RLS Matrix

| Actor                 | Answers             | Evaluations     | Results         | Audit/Idempotency |
| --------------------- | ------------------- | --------------- | --------------- | ----------------- |
| Anonymous             | Denied (401)        | Denied (401)    | Denied (401)    | Denied (401)      |
| Inactive User         | Denied (403)        | Denied (403)    | Denied (403)    | Denied (403)      |
| Owner                 | Read RPC, Write RPC | Read RPC only   | Read RPC only   | Denied            |
| Non-Owner             | Concealed (404)     | Concealed (404) | Concealed (404) | Denied            |
| Admin                 | Read-only           | Read-only       | Read-only       | Read-only         |
| Service Role (Worker) | N/A                 | Narrow RPC      | Narrow RPC      | RPC/Log writes    |

**Harden RLS and Worker Security**:

- `ENABLE ROW LEVEL SECURITY;` and `FORCE ROW LEVEL SECURITY;` must be strictly applied.
- Direct SELECT, INSERT, UPDATE, and DELETE privileges on the three Phase 6 tables remain revoked from anon and authenticated. Revocations must be explicitly scoped to target tables:
  - `REVOKE ALL ON public.interview_session_answers FROM anon, authenticated;`
  - `REVOKE ALL ON public.interview_answer_evaluations FROM anon, authenticated;`
  - `REVOKE ALL ON public.interview_session_results FROM anon, authenticated;`
  - (Do the same for relevant sequences and functions)
- Students strictly do not have read or write access to `audit_log` or `idempotency_records`.
- All student reads and writes use authenticated `SECURITY DEFINER` wrapper RPCs.
- `authenticated` users are granted EXECUTE only on:
  - owner-scoped answer read RPCs;
  - owner-scoped evaluation read RPCs;
  - owner-scoped result read RPCs;
  - approved answer mutation RPCs.
- Every read wrapper must:
  - validate the active account;
  - derive the user through `auth.uid()`;
  - verify the complete ownership chain;
  - return P0002 for missing and non-owned resources;
  - never accept a client-supplied user_id.
- Admin access must use separately approved admin wrappers. Admins do not receive unrestricted direct table SELECT access during Phase 6.
- Private worker RPCs are granted to specific service identities (if using role separation).
- Functions are `SECURITY DEFINER` and explicitly owned by the `postgres` admin role.
- For `SECURITY DEFINER` functions, prefer `SET search_path = ''` and fully qualify every object, including `public.*`, `auth.uid()`, and required PostgreSQL functions. `SET search_path = public` alone is weaker than the intended frozen security posture.
- Supabase `service_role` bypasses RLS inherently. Therefore, we explicitly rely on a server-only service-role trust boundary: the `service_role` is never used to execute arbitrary untrusted queries, and all worker mutations are funneled through secure, validated RPCs.

## 13. API Contract Schemas

- **Route UUID Parameters**: `interviewId`, `sessionId`, `sessionQuestionId` must all validate as strictly valid UUIDv4 strings.
- **AnswerSchema**: `{ id: uuid, sessionQuestionId: uuid, responseType: "text" | "code" | null, textResponse: string | null, codeResponse: { source: string, language: "python" | "javascript" | "typescript" | "java" | "cpp" | "go" | "rust", explanation: string } | null, status: "draft" | "finalized" | "skipped", version: number, createdAt: string, updatedAt: string, finalizedAt: string | null, skippedAt: string | null }` (`responseType` is only null when status = "skipped").
- **EvaluationSchema**: `{ id: uuid, sessionQuestionId: uuid, status: "pending" | "processing" | "completed" | "failed" | "skipped", overallScore: number | null, dimensionScores: Record<string, number> | null, strengths: string[] | null, improvementAreas: string[] | null, studentFeedback: string | null, evaluationVersion: number, rubricVersion: number, promptVersion: number, attemptCount: number, startedAt: string | null, completedAt: string | null, failedAt: string | null, failureCode: string | null }`
- **ResultSchema**: `{ id: uuid, sessionId: uuid, status: "pending" | "partial" | "ready" | "failed", overallScore: number | null, scoreBreakdown: Record<uuid, number> | null, strengths: string[] | null, improvementSummary: string | null, scoringVersion: number, publicationVersion: number, generatedAt: string | null, createdAt: string, updatedAt: string }`

### Strict Request Discriminated Unions

Request schemas for saving and updating drafts must be strict discriminated unions matching the answer type:

- **Text answer**: `responseType = "text"`, `textResponse required`, `codeResponse forbidden`.
- **Code answer**: `responseType = "code"`, `codeResponse required`, `textResponse forbidden`.
  Update requests must accept only the content branch matching the answer's immutable stored `response_type`.

### 1. List session answers

- **GET** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/answers`
- **Operation ID**: `listSessionAnswers`
- **Behavior**: Unpaginated list (bounded question count is inherently small).
- **Response (200)**: `{ "success": true, "data": [AnswerSchema], "meta": { "requestId": "..." } }`
- **Errors**: 404 (Missing/Concealed), 401 (Unauthorized), 403 (Inactive account)

### 2. Get one session-question answer

- **GET** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}/answer`
- **Operation ID**: `getSessionAnswer`
- **Response (200)**: `{ "success": true, "data": AnswerSchema, "meta": { "requestId": "..." } }`
- **Errors**: 404 (Missing/Concealed), 401 (Unauthorized), 403 (Inactive account)

### 3. Save draft answer

- **PUT** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}/answer`
- **Operation ID**: `saveDraftAnswer`
- **Headers**: `Idempotency-Key` (required)
- **Request Body**: Strict Discriminated Union (Text answer OR Code answer as defined above).
- **Response (201)**: `{ "success": true, "data": AnswerSchema (status=draft), "meta": { "requestId": "..." } }` (Returns 201 on first creation).
- **Errors**: 400 (Invalid payload/empty), 404, 409 (`SESSION_TERMINAL`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`), 413 (Payload too large)

### 4. Update draft answer

- **PATCH** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}/answer`
- **Operation ID**: `updateDraftAnswer`
- **Headers**: `Idempotency-Key` (required)
- **Request Body**: Strict Discriminated Union + `expectedVersion: number`. Must match immutable stored `response_type`.
- **Response (200)**: `{ "success": true, "data": AnswerSchema (version incremented), "meta": { "requestId": "..." } }`
- **Errors**: 400, 404, 409 (`STALE_UPDATE_CONFLICT`, `ANSWER_IMMUTABLE`, `SESSION_TERMINAL`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`), 413 (Payload too large)

### 5. Finalize answer

- **POST** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}/answer/finalize`
- **Operation ID**: `finalizeAnswer`
- **Headers**: `Idempotency-Key` (required)
- **Request Body**: `{ "expectedVersion": number }`
- **Response (200)**: `{ "success": true, "data": AnswerSchema (status=finalized), "meta": { "requestId": "..." } }`
- **Errors**: 400, 404, 409 (`STALE_UPDATE_CONFLICT`, `ANSWER_IMMUTABLE`, `SESSION_TERMINAL`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_IN_PROGRESS`)

### 6. Get evaluation for one answer

- **GET** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/questions/{sessionQuestionId}/evaluation`
- **Operation ID**: `getAnswerEvaluation`
- **Response (200)**: `{ "success": true, "data": EvaluationSchema, "meta": { "requestId": "..." } }`
- **Errors**: 404 (Missing/Concealed), 401 (Unauthorized), 403 (Inactive account)

### 7. Get session result

- **GET** `/api/v1/interviews/{interviewId}/sessions/{sessionId}/result`
- **Operation ID**: `getSessionResult`
- **Response (200)**: `{ "success": true, "data": ResultSchema, "meta": { "requestId": "..." } }`
- **Errors**: 404 (Missing/Concealed), 401 (Unauthorized), 403 (Inactive account)

## 14. Idempotency model

- **Scope**: Required for save draft, update draft, finalize answer, and completion-time atomic answer finalization.
- **Request Header**: `Idempotency-Key`.
- **Replay Header**: `X-Idempotency-Replay` (Response only).
- **Fingerprint**: `hash(apiVersion + method + routePattern + operation + canonical body)`. The authenticated user, idempotency key, and operation are stored or supplied separately; the key itself is not part of the request fingerprint hash.
- **Cached Body**: The `idempotency_records` table caches the exact HTTP status and JSON response body of the original successful request.
- **Behavior**:
  - Exact match returns cached payload with `X-Idempotency-Replay: true`.
  - Mismatched fingerprint returns `IDEMPOTENCY_CONFLICT`.
  - In-progress request returns `IDEMPOTENCY_IN_PROGRESS`.
- **Transaction Boundary**: The idempotency record is inserted/updated inside the same PostgreSQL transaction that modifies the answer/audit records.

## 15. Concurrency and lock ordering

- **Lock Acquisition Order**:
  1. `interview_id` lock (if manipulating interview-wide config).
  2. `session_id` lock (`pg_try_advisory_xact_lock` using the exact same Phase 5 session advisory-lock formula).
  3. Row-level `SELECT FOR UPDATE` on specific answers or evaluations.
- **Answer Mutations (Save/Update/Finalize)**: Must acquire the `session_id` lock to prevent the session from being concurrently completed. Uses `expectedVersion` checking for optimistic concurrency.
- **Session Completion**: Must explicitly extend the existing `student_complete_interview_session` transaction so that the following occur atomically: session completion, draft finalization, missing-answer skipping, evaluation creation, result pending creation, audit writes, and idempotency completion.

### Orchestration Behaviors

- **Evaluation creation**:
  - Idempotent per `answer_id` + `evaluation_version`.
  - Created atomically during session completion.
  - Duplicate creation prevented by uniqueness and replay-safe RPC behavior.
- **Worker Leases & Evaluation Completion**:
  - **Deterministic claim order**: Workers claim pending evaluations ordered by `created_at` ASC.
  - **Attempt-count increment timing**: The `attempt_count` is incremented synchronously during the lease acquisition transaction.
  - **Completion Requirements**: Worker must supply the matching `lease_token`. Status must be `processing`. `lease_expires_at` must be strictly `> clock_timestamp()`. Stale or expired workers cannot complete or fail the job.
  - **Expired-lease reclamation**: Another worker can claim an evaluation if `status = 'processing' AND lease_expires_at < NOW()`.
  - **Behavior after attempt 3**: If a worker fails (or expires) and attempts == 3, the evaluation transitions to `failed` terminally.
- **Result generation**:
  - Triggered transactionally after evaluation completion/failure.
  - Runs under the exact same Phase 5 session advisory lock formula.
  - Recomputes the terminal session-result state.
  - Publishes at most one row per `session_id` + `publication_version`.
  - Duplicate calls return the existing result without generating duplicate audit events.
- **Re-evaluation policy**:
  - Phase 6 student APIs **do not** permit re-evaluation.
  - A new `evaluation_version` may be created only through a privileged, separately authorized system/admin operation.
  - Previous evaluations and published result versions remain immutable.
  - A new result `publication_version` is generated only after the new evaluation set reaches a terminal state.

## 16. Error-code mapping

| Error Case                   | App Code                               | SQLSTATE     | HTTP | Retryable   | Public Message                                   | Ownership Conceal |
| ---------------------------- | -------------------------------------- | ------------ | ---- | ----------- | ------------------------------------------------ | ----------------- |
| Resource not found/Non-owner | `RESOURCE_NOT_FOUND`                   | `P0002`      | 404  | No          | "Resource not found."                            | Yes               |
| Idempotency in progress      | `IDEMPOTENCY_IN_PROGRESS`              | `P0006`      | 409  | Yes (Delay) | "Request is currently processing."               | No                |
| Idempotency conflict         | `IDEMPOTENCY_CONFLICT`                 | `P0007`      | 409  | No          | "Idempotency key reused with different payload." | No                |
| Invalid payload              | `INVALID_REQUEST` / `VALIDATION_ERROR` | _(Existing)_ | 400  | No          | "Invalid answer payload or malformed content."   | No                |
| Payload too large            | `PAYLOAD_TOO_LARGE`                    | _(Existing)_ | 413  | No          | "Payload size limit exceeded."                   | No                |
| Session terminal             | `SESSION_TERMINAL`                     | `P0011`      | 409  | No          | "Session is not in progress."                    | No                |
| Stale update conflict        | `STALE_UPDATE_CONFLICT`                | `P0012`      | 409  | Yes (Fetch) | "Answer has been updated by another request."    | No                |
| Answer immutable             | `ANSWER_IMMUTABLE`                     | `P0013`      | 409  | No          | "Finalized answers cannot be modified."          | No                |
| Answer skipped               | `ANSWER_SKIPPED`                       | `P0014`      | 409  | No          | "Skipped answers cannot be modified."            | No                |
| Operation failed             | `OPERATION_FAILED`                     | _(Existing)_ | 500  | Yes         | "An internal operation failed."                  | No                |

_Note: All proposed SQLSTATE codes (P0011–P0014) have been checked for collisions against existing project usages (none exist) and are officially reserved for these scenarios._

## 17. Audit-event model

Append-only events written to `audit_log` via RPC functions:

- **Events**: `ANSWER_DRAFT_CREATED`, `ANSWER_DRAFT_UPDATED`, `ANSWER_FINALIZED`, `ANSWER_SKIPPED`, `EVALUATION_QUEUED`, `EVALUATION_STARTED`, `EVALUATION_COMPLETED`, `EVALUATION_FAILED`, `RESULT_GENERATED`, `RESULT_PUBLISHED`.
- **Fields recorded**: `actor_type` ('student' | 'worker' | 'system'), `actor_user_id` (uuid or null), `owner_user_id` (uuid), `worker_identity` (string or null), `resource_type`, `resource_id`, `session_id`, `interview_id`, `request_id`, `idempotency_record_id`, `timestamp`.
- **Redaction Rules**: The `metadata` JSONB field MUST completely exclude raw AI prompts, evaluator provider keys, and raw answer text. Safe IDs, statuses, version numbers, and attempt counts are allowed.

## 18. AI evaluation security design

- **Prompt Injection Defense**: Answers are passed to LLMs strictly as parameters/data within strongly typed prompt templates, never concatenated as executable instructions.
- **Structured Output**: AI providers must return strict JSON schemas. Application layer strictly parses this JSON, mapping it to internal types. Malformed JSON immediately constitutes a retryable evaluation failure.
- **Score-Range Enforcement**: Database level `CHECK` constraints prevent out-of-bound scores regardless of application logic failure.
- **Output Sanitization**: Any generated HTML/Markdown feedback is strictly sanitized before rendering.
- **Data Minimization**: Database only stores parsed feedback strings and integer scores. Raw provider logs are discarded/not stored in the main DB to prevent accidental leakage of system instructions.

## 19. Privacy and retention considerations

- AI system prompts, system instructions, and scoring rubrics are securely versioned in source control and server memory, never exposed via API to prevent reverse engineering.
- Raw AI responses are ephemeral to the worker instance memory.

## 20. Observability plan

- **Metrics**:
  - Answer finalization latency.
  - Worker lease acquisition time, queue age.
  - AI provider latency & timeout rates.
- **Stuck detection**: Alerts trigger if evaluation leases expire frequently without completion.
- **Failure categories**: Network timeouts, schema mismatches, prompt injection flags.

## 21. Test Strategy (Scenario-Level Matrix)

- **pgTAP Database**:
  - `INSERT` / `UPDATE` access completely blocked for all roles (forcing RPC).
  - Score constraints (`-1` rejects, `101` rejects).
  - RLS isolation (user A cannot select user B's answers or evaluations).
  - Append-only audit (block `UPDATE`/`DELETE` on `audit_log`).
  - Function existence and signatures.
  - `SECURITY DEFINER` search paths (ensure `SET search_path = ''`).
  - `EXECUTE` privilege checks.
  - Forced RLS checks.
- **Unit**:
  - Score normalization logic (rounding halves, computing averages with skipped questions).
  - Idempotency middleware cache verification.
  - Evaluation schema parser strictness (rejects injected properties, malformed AI dimensions).
  - Reused key with changed hash verification.
- **Repository Integration**:
  - Concurrent `updateDraftAnswer` correctly throws `STALE_UPDATE_CONFLICT`.
  - Stale-version no-mutation assertions.
  - Cross-session and cross-question substitution (ownership bypass checks).
  - Replay without duplicate audit generation.
  - Concurrent `finalizeAnswer` vs `completeSession` correctly sequences using advisory locks.
  - Worker death scenario: lease expires, second worker successfully acquires `SKIP LOCKED`.
  - Lease-token stale-worker rejection correctly denies.
  - Three-attempt terminal failure correctly sets status to failed.
  - Duplicate result publication uniqueness constraints verified.
  - Result-version uniqueness tested.
- **Security & E2E**:
  - Anonymous user receives `401`. Non-owner receives `404`.
  - `completeSession` forces drafts to `finalized` and un-answered to `skipped`.
  - Evaluation creation on completion is correctly verified.
  - Unsupported programming language returns validation error.
  - Oversized text and code payloads correctly rejected.
  - Raw prompt/provider response redaction tested successfully.
  - Complete student E2E lifecycle (from draft creation to reading ready results).

## 22. P6.2–P6.6 implementation decomposition

- **P6.2**: Database schema, constraints, indexes, RLS, RPCs for answer mutations, privileges, pgTAP tests.
- **P6.3**: Answer retrieval, draft/finalize APIs, and integrating finalization into session-completion hook.
- **P6.4**: Evaluation worker foundation, structured AI output validation, scoring engine, retry/lease logic.
- **P6.5**: Evaluation retrieval, session result aggregation APIs, and feedback presentation.
- **P6.6**: OpenAPI alignment, security hardening, E2E lifecycle tests, final closure.

## 23. Acceptance criteria

- Full architecture defined without ambiguous state machine transitions.
- Lock acquisition order and RPC-based database access explicitly codified.
- Scoring aggregation handles skipped questions and decimal rounding deterministically.
- Security matrix fully covers all roles across all resources.
- Clean working directory reflecting only the Markdown architecture update.

## 24. Explicit decisions and open questions

- **Decision**: Code answers are evaluated as text logic in P6. Strict execution boundaries/sandboxing are deferred.
- **Decision**: `skipped` questions score `0` towards session aggregation.
- **Decision**: Terminal evaluation failure results in a `failed` session result, preventing fake `0` scores for system faults.
- **Open Questions**: None blocking P6.2 execution.
