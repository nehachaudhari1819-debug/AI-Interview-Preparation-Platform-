# P4.1 — Question Bank Requirements, Taxonomy, API Contract and Security Design

## 1. Title

P4.1 — Question Bank Requirements, Taxonomy, API Contract and Security Design

## 2. Status

IMPLEMENTED — REVIEW PENDING

## 3. Authorization

Phase 4 (Question Bank and Content Management) is FORMALLY STARTED. P4.1 is AUTHORIZED. Later subphases (P4.2+) and Phase 5 remain NOT AUTHORIZED.

## 4. Approved baseline

**Baseline Commit:** `07ce81e605e0c90b4468cb72b01298242ae553b4`
**CI Status:** Backend CI #96 — Success
**Branch:** `backend`

**Final P4.1 Design Validation:**
**Commit:** `e814ed8`
**CI Status:** Backend CI #99 — Success

## 5. Phase 4 objective

Phase 4 implements the Question Bank and Content Management foundation, establishing tables, APIs, taxonomy, and admin operations for managing interview questions, independent of any active mock interview session.

## 6. P4.1 objective

The objective of P4.1 is to define the architectural, database, API, and security requirements for the Phase 4 Question Bank before writing code. This creates a solid foundation for schema creation (P4.2) and API development (P4.3, P4.4).

## 7. Official scope

- Questions and Question lifecycle
- Question categories
- Difficulty levels
- Interview types
- Skills
- Topics
- Search, Filtering, Sorting, Pagination
- Admin-only content management
- Question-bank tests

## 8. Unauthorized extensions

- Aptitude questions
- Logical-reasoning questions
- Verbal-ability questions
- Data-interpretation questions
- DSA questions
- Core-subject questions
- Company-specific questions
- Previous-interview questions
- Role tags
- Company tags

## 9. Non-goals

- Creating runtime tables, migrations, controllers, or OpenAPI routes
- Search implementation
- Phase 5 interview creation or Phase 6 scoring
- Database seed data

## 10. Architecture checkpoint

- **Existing User Roles:** `student` and `admin`.
- **Existing admin authorization mechanism:** `private.is_active_admin()` RLS helper and Express active-account middleware.
- **Existing account-state enforcement:** Validated `active` state checking via `private.is_active_user()` and standard API middleware.
- **Existing error and response conventions:** Centralized error mappings with standard envelopes (`{ success, data, meta }`).
- **Existing idempotency architecture:** Fully integrated via `idempotency_records` table and P3.7 middleware.

## 11. Existing-project constraints

- PostgreSQL + Supabase backend stack.
- `snake_case` database schema mapped to `camelCase` API payloads.
- Row-Level Security (RLS) mandated on all public schema tables.

## 12. Question domain model

The core domain entity is split across two tables to enforce security boundaries.

**`questions` (Publicly queryable by students if published):**

- `id` (UUID, primary key)
- `question_text` (Text)
- `category_id` (UUID, foreign key)
- `difficulty_id` (UUID, foreign key)
- `interview_type_id` (UUID, foreign key)
- `status` (Enum: draft, published, archived)
- `created_by` (UUID, foreign key)
- `created_at` (TimestampTZ)
- `updated_at` (TimestampTZ)
- `published_at` (TimestampTZ, null until published)
- `archived_at` (TimestampTZ, null until archived)

**`question_internal_data` (Strictly isolated, admin-only):**

- `question_id` (UUID, primary key, foreign key)
- `reference_answer` (Text)
- `evaluation_guidance` (JSONB)
- `updated_at` (TimestampTZ)

## 13. Field classification

- **Student-readable:** `id`, `questionText`, `categoryId`, `difficultyId`, `interviewTypeId`, `skillIds`, `topicIds`, `createdAt`, `updatedAt`. (Internal lifecycle fields like status, publishedAt, archivedAt are explicitly NOT exposed to the frontend).
- **Admin-readable:** All fields across both tables, including status and lifecycle timestamps.
- **Admin-writable:** All except internally managed timestamps.
- **Internal-only / Sensitive:** `referenceAnswer`, `evaluationGuidance`.
- **Prohibited for students:** All fields in `question_internal_data`, creator PII, status, publishedAt, archivedAt.

## 14. Sensitive content

`reference_answer` and `evaluation_guidance` contain proprietary evaluation criteria and must never be exposed to students. Exposure invalidates mock interview integrity. This is enforced at the database level via the separate `question_internal_data` table protected by strict admin-only RLS.

## 15. Taxonomy model

Official taxonomies require stable identifiers, human-readable names, and active states. All taxonomies are modeled as relational tables.

**Shared Taxonomy Shape (applies to Categories, Difficulties, Interview Types, Skills, Topics):**

- `id` (UUID, PK)
- `slug` (Text, Unique)
- `name` (Text, Unique)
- `description` (Text, optional)
- `display_order` (Integer, default 0)
- `is_active` (Boolean, default true)
- `created_at` (TimestampTZ)
- `updated_at` (TimestampTZ, auto-updates on modification)

**Uniqueness:**

- `UNIQUE INDEX ON lower(slug)`
- `UNIQUE INDEX ON lower(name)`

**Archive and Referential Behavior:**

- Taxonomies do not have a dedicated `archived_at` timestamp. Archival is strictly managed by setting `is_active = false`.
- New question associations require active taxonomies.
- Publishing requires every referenced taxonomy to be active.
- Deactivating a taxonomy referenced by a published question is blocked.
- Draft or archived questions may temporarily reference an inactive taxonomy but cannot be published until all references are active.
- Foreign-key rows are never automatically deleted during archival.

## 16. Relationship model

- **Question to Category:** One-to-Many (`category_id`).
- **Question to Difficulty:** One-to-Many (`difficulty_id`).
- **Question to Interview Type:** One-to-Many (`interview_type_id`).
- **Question to Skills:** Many-to-Many via mapping table `question_skill_mappings`.
- **Question to Topics:** Many-to-Many via mapping table `question_topic_mappings`.
- **Question to Internal Data:** One-to-One (`question_internal_data.question_id`).

## 17. Content lifecycle

- **Draft:** Visible only to admins. Used during creation and review. `published_at` is null.
- **Published:** Visible to active students. Searchable and filterable. `published_at` is populated.
- **Archived:** Preserved for history, removed from student visibility. `archived_at` is populated.
- **Restore Behavior:** Restoring an archived question sets it back to **Draft** only. It must be explicitly republished through the `/publish` endpoint to become visible to students again.

## 18. Student access

Students may access only `Published` questions and active taxonomy values. They have no ownership over the global question bank. Anonymous access is strictly denied.

## 19. Admin access

Admins may create, update, publish, archive, and restore questions. Admins may view draft and archived questions, and they possess read/write access to sensitive internal fields and all taxonomies.

## 20. Student API inventory

- `GET /api/v1/questions` (Paginated, filtered list)
- `GET /api/v1/questions/:questionId` (Detail view)
- `GET /api/v1/questions/categories`
- `GET /api/v1/questions/difficulties`
- `GET /api/v1/questions/interview-types`
- `GET /api/v1/questions/skills`
- `GET /api/v1/questions/topics`

## 21. Admin API inventory

- `POST /api/v1/admin/questions`
- `GET /api/v1/admin/questions`
- `GET /api/v1/admin/questions/:questionId`
- `PATCH /api/v1/admin/questions/:questionId`
- `POST /api/v1/admin/questions/:questionId/publish`
- `POST /api/v1/admin/questions/:questionId/archive`
- `POST /api/v1/admin/questions/:questionId/restore`

**Taxonomy Management:**
Valid `taxonomyType` values: `categories`, `difficulties`, `interview-types`, `skills`, `topics`.

- `POST /api/v1/admin/taxonomies/:taxonomyType`
- `PATCH /api/v1/admin/taxonomies/:taxonomyType/:id` (Updates metadata. To **archive** or **restore**, patch the `isActive` boolean).

## 22. Search contract

- **Query Parameter:** Exactly `search`.
- **Empty State:** An omitted or empty `search` parameter explicitly means "no search filter applied."
- **Minimum length:** 3 characters (when provided).
- **Maximum length:** 100 characters.
- **Behavior:** Case-insensitive search on `questions.question_text`.
- **Security:** Excludes `question_internal_data` completely from search.

## 23. Filter contract

- **Allowed filters:** `categoryId`, `difficultyId`, `interviewTypeId`, `skillId`, `topicId`.
- Admin-only filter: `status`.
- **Behavior:** AND logic across different parameters, OR logic for multiple values in the same parameter.
- **Validation:** Must be valid UUIDv4 strings. Array parameter limit: max 10 elements.

## 24. Sort contract

- **Parameters:** `sortBy`, `sortDir` (asc, desc)
- **Allowed fields:** `createdAt`, `updatedAt`, `publishedAt`.
- **Tie-breaker:** Stable deterministic tie-breaker via `id` (UUID).
- **Validation:** Unrecognized sort keys are rejected.

## 25. Pagination contract

- **Strategy:** Page-based offset pagination. NO cursor support in Phase 4.
- **Parameters:** `page` (integer, default 1, min 1), `limit` (integer, default 20, max 100).
- **Metadata Response:** Returns total metrics alongside page context.

## 26. Response contracts

Every standard API response must include the approved envelope and `meta.requestId`.

**QuestionSummary (Student List Item):**

```json
{
  "id": "uuid",
  "questionText": "...",
  "categoryId": "uuid",
  "difficultyId": "uuid",
  "interviewTypeId": "uuid",
  "skillIds": ["uuid"],
  "topicIds": ["uuid"],
  "createdAt": "iso",
  "updatedAt": "iso"
}
```

**QuestionDetail (Student Detail Item):**

```json
{
  "id": "uuid",
  "questionText": "...",
  "categoryId": "uuid",
  "difficultyId": "uuid",
  "interviewTypeId": "uuid",
  "skillIds": ["uuid"],
  "topicIds": ["uuid"],
  "createdAt": "iso",
  "updatedAt": "iso"
}
```

**AdminQuestionDetail (Admin Detail Item):**

```json
{
  "id": "uuid",
  "questionText": "...",
  "categoryId": "uuid",
  "difficultyId": "uuid",
  "interviewTypeId": "uuid",
  "skillIds": ["uuid"],
  "topicIds": ["uuid"],
  "status": "published",
  "publishedAt": "iso",
  "archivedAt": null,
  "createdAt": "iso",
  "updatedAt": "iso",
  "referenceAnswer": "...",
  "evaluationGuidance": { "rubric": "..." }
}
```

**QuestionListResponse (Student):**

```json
{
  "success": true,
  "data": [{ "id": "uuid", "...": "..." }],
  "meta": {
    "requestId": "uuid",
    "totalItems": 150,
    "totalPages": 8,
    "currentPage": 1,
    "limit": 20,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**TaxonomyListResponse:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "slug": "...",
      "name": "...",
      "description": "...",
      "displayOrder": 0,
      "isActive": true
    }
  ],
  "meta": { "requestId": "uuid" }
}
```

## 27. Validation rules

- **Question Text:** Required, trimmed, min 10 chars, max 2000 chars.
- **Taxonomies:** Must exist and be active upon question association.
- **Status Transitions:** Draft -> Published -> Archived -> Draft (via restore).

## 28. Authorization matrix

Every unspecified cell defaults to **DENY**.

| Actor               | Q List | Q Detail | Draft/Arch Reads | Sens. Reads | Q Create | Q Update | Q Pub/Arch/Rest | Tax. Mgmt | Audit Read |
| :------------------ | :----: | :------: | :--------------: | :---------: | :------: | :------: | :-------------: | :-------: | :--------: |
| Anonymous           |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Active Student      | ALLOW  |  ALLOW   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Suspended Student   |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Del-Pending Student |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Deleted Student     |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Active Admin        | ALLOW  |  ALLOW   |      ALLOW       |    ALLOW    |  ALLOW   |  ALLOW   |      ALLOW      |   ALLOW   |    DENY    |
| Suspended Admin     |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Del-Pending Admin   |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |
| Deleted Admin       |  DENY  |   DENY   |       DENY       |    DENY     |   DENY   |   DENY   |      DENY       |   DENY    |    DENY    |

_(Note: Active Students only read published questions. Active Admins cannot read Audits through Phase 4 routes)._

**Service Role:**
INTERNAL ONLY — NOT EXPOSED THROUGH PHASE 4 HTTP ROUTES.
Permitted only for:

- migrations
- trusted maintenance
- controlled test setup
- explicitly authorized internal jobs

## 29. RLS strategy

- **Taxonomy tables:** `taxonomies_authenticated_read` (uses `private.is_active_user()`), `taxonomies_admin_write` (uses `private.is_active_admin()`).
- **`questions`:** `questions_student_published_select` (where status = 'published' AND `private.is_active_user()`). `questions_admin_all` (uses `private.is_active_admin()`).
- **`question_internal_data`:** `internal_data_admin_all` (uses `private.is_active_admin()`). Explicitly NO student read policy.

## 30. Privilege strategy

The application repository layer restricts column selection. The database RLS strictly blocks any accidental read access to `question_internal_data` by non-admins. The service role is restricted to internal operational usage.

## 31. Sensitive-column protection

`reference_answer` and `evaluation_guidance` are strictly isolated into the `question_internal_data` table. Database-enforced Row-Level Security explicitly denies student access to this table entirely, ensuring defense in depth beyond application mapping logic.

## 32. Audit plan

Audit writes must be **transactionally durable** with the source database mutation. Request IP may remain in existing operational security logs according to the existing logging policy, but it is explicitly NOT stored in these durable content audit events. Failed operations are NOT audited in the `audit_logs` table. No-op updates (no fields changed) do NOT write audit logs.

**Safe Metadata:**
Audit metadata may contain:

- `questionId`
- `taxonomyId`
- `previousState`
- `nextState`
- sorted changedFields

Audit metadata must NOT contain:

- IP address
- user agent
- question text
- reference answer
- evaluation guidance
- request body
- tokens
- raw Idempotency-Key

**Actions (Resource Type: `QUESTION` or `TAXONOMY`):**

- `QUESTION_CREATED`
- `QUESTION_UPDATED`
- `QUESTION_PUBLISHED`
- `QUESTION_ARCHIVED`
- `QUESTION_RESTORED`
- `TAXONOMY_CREATED`
- `TAXONOMY_UPDATED` (covers edits)
- `TAXONOMY_ARCHIVED` (triggered when `isActive` -> `false`)
- `TAXONOMY_RESTORED` (triggered when `isActive` -> `true`)

## 33. Idempotency plan

Idempotency applies to admin mutative routes via the `Idempotency-Key` header and the generic `idempotency_records` table.

- **Operations protected:**
  - `admin.questions.create`
  - `admin.questions.publish`
  - `admin.questions.archive`
  - `admin.questions.restore`
  - `admin.taxonomies.create`
- _(Note: Taxonomy archive/restore is performed via generic PATCH `isActive`, which is conventionally non-idempotent-protected in this architecture, but safe since it sets boolean state)._

**Behavioral Contract:**

- **Canonical fingerprint:** `SHA-256(apiVersion + method + routePattern + authenticatedUserId + operationName + canonicalSortedRequestBody)`
- **Replay:** Return the original stored HTTP status and response body.
- **Conflict:** `409 IDEMPOTENCY_CONFLICT`
- **Concurrent processing:** `409 CONCURRENT_REQUEST_IN_PROGRESS`
- **Failure:** Persist the approved failed transition through the existing P3.7 `fail-idempotency` workflow.
- **Lease:** 30 seconds
- **Record retention:** 24 hours

## 34. Error contracts

- `401 AUTHENTICATION_REQUIRED` / `INVALID_TOKEN`
- `403 ACCOUNT_DISABLED` / `ACCOUNT_DELETED` / `ADMIN_REQUIRED`
- `404 QUESTION_NOT_FOUND` / `TAXONOMY_NOT_FOUND`
- `409 IDEMPOTENCY_CONFLICT`
- `409 CONCURRENT_REQUEST_IN_PROGRESS`
- `422 VALIDATION_ERROR` / `INVALID_STATUS_TRANSITION`
- `429 RATE_LIMIT_EXCEEDED`
- `500 INTERNAL_SERVER_ERROR`
- `503 DATABASE_UNAVAILABLE`

## 35. Rate-limit plan

Uses existing verified policies only. Dedicated admin rate limits require separate Phase 4 implementation and are NOT assumed available.

- **Student endpoints:** `global-api`
- **Admin endpoints:** `global-api` (paired strictly with active-admin authorization middleware).

## 36. Cache plan

- Read-heavy taxonomy endpoints (`/categories`, `/skills`) can utilize internal backend caching.
- External HTTP Cache-Control must be `private, no-store` to prevent CDN caching of authenticated content. NO public caching.

## 37. OpenAPI plan

New components will be modeled using Zod:

- `QuestionSummarySchema`
- `QuestionDetailSchema`
- `TaxonomySchema`
- Endpoints will be documented without exposing internal admin properties in student models.

## 38. Frontend integration plan

Frontend receives `page`, `limit`, and metadata for list tables. Empty states must gracefully display "No questions found."

## 39. Database test plan

- Constraints and foreign keys check (pgTAP).
- RLS read enforcement blocking student access to `question_internal_data` (pgTAP).
- Admin RLS override testing.

## 40. Unit test plan

- Zod schema strict parsing tests.
- Pagination metadata calculator tests.
- Lifecycle transition guard tests.

## 41. Integration test plan

- Router & Controller HTTP tests for all endpoints.
- Authorization rejection for admin routes by student tokens.
- Pagination offset and filter intersection testing (NO cursor tests).

## 42. Security test plan

- SQL injection via search parameter testing.
- Over-posting fields testing (attempting to set internal data as student).
- IDOR (Attempting to view draft or internal data).

## 43. E2E test plan

- Admin creates draft -> publishes -> student searches -> student views.

## 44. Expected P4.2 migration

Migration `20260101000017_create_question_bank_tables.sql` will include:

- `question_categories`, `question_difficulties`, `question_interview_types`, `question_skills`, `question_topics`
- `questions`
- `question_internal_data`
- `question_skill_mappings`, `question_topic_mappings`

## 45. Expected P4.2 files

- The migration file above.
- Regenerated `database.types.ts`.

## 46. Risks

- Large text search latency.
- Deep pagination performance on `OFFSET`.

## 47. Known limitations

- Pure offset pagination deteriorates after high page numbers (acceptable for Phase 4 scale).

## 48. Deferred extensions

- DSA, Aptitude, Company Tags, Role Tags, Phase 5 features.

## 49. Acceptance criteria

- All sections of P4.1 defined accurately.
- Database, API, and Security scopes outlined.
- No code generated.
- Verified cleanly via Git.

## 50. Approval checkpoint

Awaiting final explicit Phase 4 P4.1 formal approval from the Project Reviewer.

## 51. Next-subphase boundary

Upon approval, P4.2 (Question Bank Database Schema, Constraints and RLS Foundation) will be authorized.
