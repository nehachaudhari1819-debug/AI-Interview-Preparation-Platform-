# Phase 4.6 — Question Bank OpenAPI Contract, Documentation, Security and Final Phase-4 Closure

**Status**: IMPLEMENTED — REVIEW PENDING

## Objective

Complete the OpenAPI contract for the entire implemented Question Bank backend. This phase documents and verifies all Question Bank behavior implemented during previous P4 phases without altering the underlying runtime logic or database schemas.

## Baseline

- **Approved Baseline**: `1e1037f5faf64ca9b3eacd8d1d03c91d41f18973`
- **Official P4.5 Finalized**: Yes

## Scope

- Exact mapping of all Question Bank routes to OpenAPI components and paths.
- Comprehensive request schemas, validation constraints, and pagination contracts.
- Thorough modeling of response schemas (Student vs. Admin).
- Documentation of explicit concurrency, lifecycle transitions, and idempotent operations.
- Strong security verification (Auth boundary, Role checks, Information disclosure).

## Exclusions

- No database migrations.
- No modifications to runtime business logic or services.
- No new features (no bulk import, AI generation, aptitude modules).
- No initiation of P4.7 work.

## Route Inventory

### Admin Routes

- `GET /api/v1/admin/questions`
- `GET /api/v1/admin/questions/:questionId`
- `POST /api/v1/admin/questions`
- `PATCH /api/v1/admin/questions/:questionId`
- `POST /api/v1/admin/questions/:questionId/publish`
- `POST /api/v1/admin/questions/:questionId/archive`
- `POST /api/v1/admin/questions/:questionId/restore`
- `POST /api/v1/admin/taxonomies/:taxonomyType`
- `PATCH /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId`
- `POST /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/archive`
- `POST /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/restore`

### Student Routes

- `GET /api/v1/questions`
- `GET /api/v1/questions/:questionId`
- `GET /api/v1/questions/categories`
- `GET /api/v1/questions/difficulties`
- `GET /api/v1/questions/interview-types`
- `GET /api/v1/questions/skills`
- `GET /api/v1/questions/topics`

## Endpoint-Contract Matrix

| Method | Route                                                        | Controller/Handler                                             | Auth | Admin | Idempotency | Success | Error Codes                                                                                                                   | Audit / Operation                                       |
| ------ | ------------------------------------------------------------ | -------------------------------------------------------------- | ---- | ----- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| GET    | `/api/v1/questions`                                          | `createGetQuestionsController`                                 | Yes  | No    | No          | 200     | `AUTHENTICATION_REQUIRED`, `VALIDATION_ERROR`                                                                                 | N/A                                                     |
| GET    | `/api/v1/questions/:questionId`                              | `createGetQuestionDetailController`                            | Yes  | No    | No          | 200     | `AUTHENTICATION_REQUIRED`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`                                                           | N/A                                                     |
| GET    | `/api/v1/questions/:taxonomyType`                            | `createGetTaxonomiesController`                                | Yes  | No    | No          | 200     | `AUTHENTICATION_REQUIRED`, `VALIDATION_ERROR`                                                                                 | N/A                                                     |
| GET    | `/api/v1/admin/questions`                                    | `router.get("/questions")`                                     | Yes  | Yes   | No          | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`                                                             | N/A                                                     |
| GET    | `/api/v1/admin/questions/:questionId`                        | `router.get("/questions/:questionId")`                         | Yes  | Yes   | No          | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`                                       | N/A                                                     |
| POST   | `/api/v1/admin/questions`                                    | `router.post("/questions")`                                    | Yes  | Yes   | Yes         | 201     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `IDEMPOTENCY_*`                                            | `QUESTION_CREATED` / `admin_create_question`            |
| PATCH  | `/api/v1/admin/questions/:questionId`                        | `router.patch("/questions/:questionId")`                       | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `IDEMPOTENCY_*`                      | `QUESTION_UPDATED` / `admin_update_question`            |
| POST   | `/api/v1/admin/questions/:questionId/publish`                | `router.post("/questions/:questionId/publish")`                | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*` | `QUESTION_PUBLISHED` / `admin_publish_question`         |
| POST   | `/api/v1/admin/questions/:questionId/archive`                | `router.post("/questions/:questionId/archive")`                | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*` | `QUESTION_ARCHIVED` / `admin_archive_question`          |
| POST   | `/api/v1/admin/questions/:questionId/restore`                | `router.post("/questions/:questionId/restore")`                | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_NOT_FOUND`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*` | `QUESTION_RESTORED` / `admin_restore_question`          |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType`                     | `router.post("/taxonomies/:taxonomyType")`                     | Yes  | Yes   | Yes         | 201     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*`                       | `QUESTION_TAXONOMY_CREATED` / `admin_create_taxonomy`   |
| PATCH  | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId`         | `router.patch("/taxonomies/:taxonomyType/:taxonomyId")`        | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*`                       | `QUESTION_TAXONOMY_UPDATED` / `admin_update_taxonomy`   |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/archive` | `router.post("/taxonomies/:taxonomyType/:taxonomyId/archive")` | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*`                       | `QUESTION_TAXONOMY_ARCHIVED` / `admin_archive_taxonomy` |
| POST   | `/api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/restore` | `router.post("/taxonomies/:taxonomyType/:taxonomyId/restore")` | Yes  | Yes   | Yes         | 200     | `AUTHENTICATION_REQUIRED`, `FORBIDDEN_ACCESS`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `IDEMPOTENCY_*`                       | `QUESTION_TAXONOMY_RESTORED` / `admin_restore_taxonomy` |

_(Note: `IDEMPOTENCY_*` covers `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_INVALID`, `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_SERVICE_UNAVAILABLE`)_

## Student API Contract

- Focuses on safe, validated exposure of published data.
- **Envelopes**: Uses standard success arrays with nested `pagination` object (`page`, `limit`, `totalItems`, `totalPages`, `hasNextPage`, `hasPreviousPage`).
- **Response Shape**: `QuestionSummary` / `QuestionDetail` excluding internal or administrative state (e.g. `status`, `referenceAnswer`, `evaluationGuidance`).
- **Taxonomy**: Custom camelCase mappers (`id`, `slug`, `name`, `description`, `displayOrder`, `isActive`).

## Admin Question Contract

- Focuses on administrative access with exact metadata exposure.
- **Envelopes**: Collection results inline pagination properties into the standard `meta` block (`totalItems`, `totalPages`, `currentPage`, `limit`, `hasNextPage`, `hasPreviousPage`).
- **Response Shape**: `AdminQuestionDetail` comprising `id`, `questionText`, `categoryId`, `difficultyId`, `interviewTypeId`, `skillIds`, `topicIds`, `status`, `publishedAt`, `archivedAt`, `createdAt`, `updatedAt`, `referenceAnswer`, `evaluationGuidance`.
- **Security**: Requires active account and explicit admin-role authorization logic.

## Admin Taxonomy Contract

- Exposes raw database row mapping due to `supabase.from(table).select()` pattern (`id`, `slug`, `name`, `description`, `display_order`, `is_active`, `created_at`, `updated_at`).

## Search Contract

- Supports generic websearch queries mapped natively by `PostgREST`.
- Restricted by Zod to `min 3`, `max 100`, trimmed strings.

## Filtering Contract

- Arrays (max 10) of UUID strings allowed for: `categoryId`, `difficultyId`, `interviewTypeId`, `skillId`, `topicId`. Repeated query keys or comma-separated parsing is natively integrated.
- Admin adds `status` filtering for max 3 values of `draft`, `published`, `archived`.

## Sorting Contract

- Student sortBy: `createdAt` | `updatedAt` (Default `createdAt`).
- Admin sortBy: `createdAt` | `updatedAt` | `publishedAt` (Default `createdAt`).
- sortDir: `asc` | `desc` (Default `desc`).

## Pagination Contract

- Query properties: `page` (min 1, default 1), `limit` (min 1, max 100, default 20).

## Idempotency Contract

- Enforced on all mutation routes by robust middleware.
- Request-Key mapped to `Idempotency-Key` header (exactly one header allowed, min 1 max 255 chars).
- Validation outcomes include: `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_INVALID`, `IDEMPOTENCY_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `IDEMPOTENCY_SERVICE_UNAVAILABLE`.

## Replay Contract

- Repeated valid idempotent requests with an identical request fingerprint emit a 200/201 replay caching response representing original payload, deliberately bypassing audit logic for replay sequences.

## Lifecycle Contract

- Questions follow `draft` -> `published` -> `archived`. They can be restored (`archived` -> `draft`).
- Taxonomies toggle `is_active` boolean field via archive/restore endpoints.
- Invalid state transitions reject request via validation mapping.

## Concurrency Contract

- True simultaneous lifecycle attempts rely on database level `pg` pessimistic checking.
- Colliding queries map cleanly to a 409 `RESOURCE_CONFLICT` response logic.

## Audit Considerations

- Audit logic is purely internal and not exposed in API response structures.
- Events map exactly to required operation actions listed in Endpoint-Contract Matrix.

## Security Model

- Uses Bearer Authentication (JWT).
- Enforces active account checks, and admin endpoints rigorously verify database-level roles (`FORBIDDEN_ACCESS`).
- No database internal artifacts (constraint names, queries) are exposed by validation errors.

## Error Model

- Follows structured standard API Error Envelopes (`success`, `message`, `code`, `errors`, `meta.requestId`).
- Utilizes explicit semantic error definitions (`RESOURCE_NOT_FOUND`, `VALIDATION_ERROR`, `RESOURCE_CONFLICT`, `AUTHENTICATION_REQUIRED`).

## OpenAPI Component Inventory

- **Schemas**: `QuestionSummary`, `AdminQuestionDetail`, `TaxonomyResponse`, `AdminTaxonomyRow`, `CreateQuestionBody`, `UpdateQuestionBody`, `CreateTaxonomyBody`, `UpdateTaxonomyBody`, Pagination schemas, Question filter metadata.
- **Parameters**: `Idempotency-Key` (header parameter reference).

## Test Strategy

- Validation relies strictly on Jest integration and security test boundaries ensuring routing schema compliance, error payload checks, and idempotency mapping logic. No data leaks via generic errors.

## Validation Evidence

[Placeholder: CI Run outcomes and CLI test command proof]

## Final Commit and CI Evidence

[Placeholder: SHA confirmation]

## Known Limitations

[Placeholder: Any documented constraints]

## Approval

Status: IMPLEMENTED — REVIEW PENDING
