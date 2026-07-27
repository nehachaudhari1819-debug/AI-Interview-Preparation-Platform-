# 04. Admin Question Bank Management APIs

**Status**: IMPLEMENTED — REVIEW PENDING

## Objective

This phase introduces the Admin Question Bank Management APIs which handle creation, updating, archiving, publishing, and taxonomy management for questions.

## Authorized Scope

The approved P4.4 scope includes:

- Question creation, update, publish, archive, and restore
- Taxonomy creation, update, archive, and restore
- Strict Admin authorization and middleware boundaries

## Excluded Scope

- P4.5: Audit, idempotency, generic replay/conflict handling, concurrency protection
- P4.6: OpenAPI definitions and frontend handoff

## Exact Routes

### Taxonomies

- `POST /api/v1/admin/taxonomies/:taxonomyType` - Creates a new taxonomy (category, difficulty, interview-type, skill, topic).
- `PATCH /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId` - Updates an existing taxonomy.
- `POST /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/archive` - Marks a taxonomy as inactive.
- `POST /api/v1/admin/taxonomies/:taxonomyType/:taxonomyId/restore` - Marks a taxonomy as active.

### Questions

- `GET /api/v1/admin/questions` - Lists questions with admin-level filters (including `status` and sorting).
- `GET /api/v1/admin/questions/:questionId` - Retrieves a specific question including internal data (reference answers, rubrics).
- `POST /api/v1/admin/questions` - Creates a new question in `draft` status.
- `PATCH /api/v1/admin/questions/:questionId` - Updates a draft or published question.
- `POST /api/v1/admin/questions/:questionId/publish` - Transitions a draft to `published`.
- `POST /api/v1/admin/questions/:questionId/archive` - Transitions a published question to `archived`.
- `POST /api/v1/admin/questions/:questionId/restore` - Reverts an archived question to `draft`.

## Authentication and Admin Authorization

All endpoints under `/api/v1/admin` require:

1. Valid user session (JWT).
2. Active account status (checked dynamically).
3. The principal's real-time database role strictly equal to `admin`. A stale JWT admin claim cannot override a current database downgrade.

## Request and Response Contracts

Validation is strictly enforced using Zod schemas mapping exactly to the Database constraints. Empty payload bodies are rejected. UUID constraints and maximum string lengths align directly with the DB schema definitions.

## Question Lifecycle Rules

- `draft` -> `published`
- `published` -> `archived`
- `archived` -> `draft` (Restore operation)
- Lifecycle rules actively reject invalid transitions (e.g., publishing an already published question).

## Taxonomy Lifecycle Rules

- **Create**: Inserts new taxonomies as active.
- **Update**: Replaces basic fields.
- **Archive**: Deactivates the taxonomy. Database foreign key constraints prevent archiving if referenced by active questions.
- **Restore**: Reactivates the taxonomy.

## Database Tables Used

- `questions`
- `question_internal_data`
- `question_skill_mappings`
- `question_topic_mappings`
- `question_categories`, `question_difficulties`, `question_interview_types`, `question_skills`, `question_topics`

## Error Behavior

Database restriction violations are normalized into safe `PersistenceError` responses, which the router converts to appropriate 4xx/5xx HTTP codes rather than exposing raw PostgreSQL messages to the client.

## Security Boundaries

- Prevents accidental exposure of service-role credentials by dynamically generating a user-scoped Supabase client.
- Sensitive `question_internal_data` is strictly gated to the admin boundary.

## Known Limitations & Atomicity

Transaction atomicity is strictly enforced for question creation and updates via Migration 20 RPCs (`admin_create_question` and `admin_update_question`). These functions execute with `SECURITY INVOKER` privileges to ensure all existing Row Level Security (RLS) policies are honored transparently.
The system securely rolls back all operations across `questions`, `question_internal_data`, `question_skill_mappings`, and `question_topic_mappings` if any single constraint fails or mapping is invalid.

## Test Coverage

_Final counts and evidence to be added upon completion of CI Pipeline._

## Final SHA & CI

_To be provided upon formal approval validation._
