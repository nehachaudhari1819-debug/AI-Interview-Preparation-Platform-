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
- Hard deletions are generally prohibited for transactional/user records. Soft deletion via `deleted_at` is the standard.

## 12. Question domain model

The core domain entity `Question` requires the following fields:

- `id` (UUID, primary key)
- `questionText` (String)
- `categoryId` (UUID)
- `difficulty` (Enum: easy, medium, hard)
- `interviewType` (Enum: technical, behavioral, mixed)
- `skills` (Array of UUIDs or Slugs)
- `topics` (Array of UUIDs or Slugs)
- `status` (Enum: draft, published, archived)
- `referenceAnswer` (String, internal)
- `evaluationGuidance` (JSON, internal)
- `createdBy` (UUID)
- `createdAt` (TimestampTZ)
- `updatedAt` (TimestampTZ)
- `deletedAt` (TimestampTZ)

## 13. Field classification

- **Student-readable:** `id`, `questionText`, `category`, `difficulty`, `interviewType`, `skills`, `topics`, `status`, `createdAt`, `updatedAt`.
- **Admin-readable:** All fields including `referenceAnswer` and `evaluationGuidance`.
- **Admin-writable:** All except internally managed timestamps.
- **Internal-only / Sensitive:** `referenceAnswer`, `evaluationGuidance`.
- **Prohibited for students:** All sensitive fields, `deletedAt`, creator PII.

## 14. Sensitive content

`referenceAnswer` and `evaluationGuidance` contain proprietary evaluation criteria and must never be exposed to students. Exposure invalidates mock interview integrity.

## 15. Taxonomy model

Official taxonomies require stable identifiers, human-readable names, and active states.

- **Question Categories:** Relational table (`question_categories`) with `id`, `slug`, `name`, `is_active`.
- **Skills:** Relational table (`question_skills`) with `id`, `slug`, `name`, `is_active`.
- **Topics:** Relational table (`question_topics`) with `id`, `slug`, `name`, `is_active`.
- **Difficulty & Interview Types:** Bound locally via PostgreSQL Native Enums (`difficulty_enum`, `interview_type_enum`) as they represent strict platform invariants.

## 16. Relationship model

- **Question to Category:** One-to-Many (`category_id` on Question).
- **Question to Difficulty:** Field enum.
- **Question to Interview Type:** Field enum.
- **Question to Skills:** Many-to-Many via mapping table `question_skill_mappings`.
- **Question to Topics:** Many-to-Many via mapping table `question_topic_mappings`.

## 17. Content lifecycle

- **Draft:** Visible only to admins. Used during creation and review.
- **Published:** Visible to active students. Searchable and filterable.
- **Archived:** Preserved for history, removed from student visibility, retained for active ongoing interview references. Admin visible.

## 18. Student access

Students may access only `Published` questions, active taxonomy values, and safe metadata fields. They have no ownership over the global question bank.

## 19. Admin access

Admins may create, update, publish, archive, and soft-delete questions. Admins may view draft and archived questions, and they possess read/write access to sensitive internal fields and taxonomies.

## 20. Student API inventory

- `GET /api/v1/questions` (Paginated, filtered list)
- `GET /api/v1/questions/:questionId` (Detail view)
- `GET /api/v1/questions/categories`
- `GET /api/v1/questions/difficulty-levels`
- `GET /api/v1/questions/interview-types`
- `GET /api/v1/questions/skills`
- `GET /api/v1/questions/topics`

## 21. Admin API inventory

- `POST /api/v1/admin/questions`
- `GET /api/v1/admin/questions` (Supports all statuses)
- `GET /api/v1/admin/questions/:questionId` (Includes sensitive fields)
- `PATCH /api/v1/admin/questions/:questionId`
- `POST /api/v1/admin/questions/:questionId/publish`
- `POST /api/v1/admin/questions/:questionId/archive`

## 22. Search contract

- **Query Parameter:** `q` or `search`
- **Minimum length:** 3 characters.
- **Maximum length:** 100 characters.
- **Behavior:** Case-insensitive search on `question_text`.
- **Security:** Excludes `reference_answer` completely from search tokenization.

## 23. Filter contract

- **Allowed filters:** `categoryId`, `difficulty`, `interviewType`, `skillId`, `topicId`.
- Admin-only filter: `status`.
- **Behavior:** AND logic across different parameters, OR logic for multiple values in the same parameter (e.g., `?difficulty=easy,medium`).
- **Validation:** Invalid UUIDs or unknown slugs return validation errors immediately.

## 24. Sort contract

- **Parameters:** `sortBy`, `sortDir` (asc, desc)
- **Allowed fields:** `createdAt`, `updatedAt`, `difficulty`.
- **Tie-breaker:** Stable deterministic tie-breaker via `id`.
- **Validation:** Unrecognized sort keys are rejected.

## 25. Pagination contract

- **Style:** Offset/Page Pagination (aligning with P1 API Blueprint).
- **Parameters:** `page` (default 1), `limit` (default 20, max 100).
- **Metadata Response:** Returns `totalItems`, `totalPages`, `currentPage`, `limit`, `hasNextPage`, `hasPreviousPage`.

## 26. Response contracts

Student Question Response (redacted):

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "questionText": "...",
    "category": { "id": "...", "name": "..." },
    "difficulty": "medium",
    "status": "published"
  }
}
```

## 27. Validation rules

- **Question Text:** Required, trimmed, min 10 chars, max 2000 chars.
- **Taxonomies:** Must exist and be active upon question association.
- **Status Transitions:** Draft -> Published -> Archived -> Published.
- **Filters/Search:** Length bounded. Array parameter limit: max 10 elements.

## 28. Authorization matrix

- **Anonymous:** DENY ALL.
- **Suspended/Deleted/Pending Student:** DENY ALL.
- **Active Student:** READ published questions, READ taxonomies.
- **Active Admin:** CREATE, READ, UPDATE, ARCHIVE all questions and taxonomies. READ sensitive fields.
- **Service Role:** System jobs and transitions only.

## 29. RLS strategy

- `question_categories`, `question_skills`: `PUBLIC_READ` for active, `ADMIN_WRITE`.
- `questions`: `questions_student_published_select` for published reads. `questions_admin_all` for admin reads/writes.
- Ownership checks map to `private.is_active_user()` and `private.is_active_admin()`.

## 30. Privilege strategy

The application repository layer restricts column selection. The service role is restricted to migrations and specific system workflows (e.g., cron jobs), not standard application reads.

## 31. Sensitive-column protection

`reference_answer` and `evaluation_guidance` will be stored in the main `questions` table to simplify relationships, but tightly protected using **Data-Access Layer Projections**. The Express API mapping layer explicitly omits these fields for student routes. RLS prevents unauthorized backend data extraction.

## 32. Audit plan

Actions to be audited in `audit_logs`:

- `QUESTION_CREATED`
- `QUESTION_UPDATED`
- `QUESTION_STATUS_CHANGED` (e.g., Publish/Archive)
- `TAXONOMY_CREATED`
- `TAXONOMY_UPDATED`

## 33. Idempotency plan

`Idempotency-Key` headers will be required for:

- `POST /api/v1/admin/questions`
- `POST /api/v1/admin/questions/:questionId/publish`
- `POST /api/v1/admin/questions/:questionId/archive`

## 34. Error contracts

Utilizes standard `ApiError` format:

- `401 Unauthorized` (Token invalid)
- `403 Forbidden` (Account suspended, Admin required, Draft question accessed by student)
- `404 Not Found` (Question/Category UUID missing)
- `422 Unprocessable Entity` (Invalid transition, Duplicate taxonomy)

## 35. Rate-limit plan

- **Student Reads:** Standard limit (e.g., 100 req / minute).
- **Search endpoints:** Tighter limit (e.g., 30 req / minute).
- **Admin Writes:** Moderate limit (e.g., 50 req / minute).

## 36. Cache plan

- Read-heavy taxonomy endpoints (`/categories`, `/skills`) can utilize `Cache-Control: public, max-age=300`.
- Sensitive and admin responses use `Cache-Control: no-store`.

## 37. OpenAPI plan

New components will be modeled using Zod:

- `QuestionSummarySchema`
- `QuestionDetailSchema`
- `TaxonomySchema`
- Endpoints will be documented without exposing internal admin properties in student models.

## 38. Frontend integration plan

Frontend receives `page`, `limit`, and metadata for list tables. Empty states must gracefully display "No questions found." Unauthorized status triggers global logout/notification flows.

## 39. Database test plan

- Constraints and foreign keys check (pgTAP).
- RLS read enforcement for published vs draft (pgTAP).
- Admin RLS override testing.

## 40. Unit test plan

- Zod schema strict parsing tests.
- Pagination metadata calculator tests.
- Lifecycle transition guard tests (Draft -> Publish).

## 41. Integration test plan

- Router & Controller HTTP tests for all endpoints.
- Authorization rejection for admin routes by student tokens.
- Pagination cursor and filter intersection testing.

## 42. Security test plan

- SQL injection via search parameter testing.
- Over-posting fields testing (attempting to set `referenceAnswer` as student).
- IDOR (Attempting to view draft).

## 43. E2E test plan

- Admin creates draft -> publishes -> student searches -> student views.

## 44. Expected P4.2 migration

Migration `20260101000017_create_question_bank_tables.sql` will include:

- `question_categories`
- `question_skills`
- `question_topics`
- `questions`
- `question_skill_mappings`
- `question_topic_mappings`

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
