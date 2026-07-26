# P4.2 Question Bank Database Schema, Constraints and RLS Foundation

## 1. Title

P4.2 Question Bank Database Schema, Constraints and RLS Foundation

## 2. Status

P4.2 STATUS: IMPLEMENTED — REVIEW PENDING

## 3. Authorization

GRANTED

## 4. Approved baseline

`1f53d9da24b58881415b4d324f56c1507a71936b`

## 5. P4.1 approval evidence

Backend CI #100 — Success

## 6. P4.2 scope

Implement the secure relational database foundation for the approved Phase 4 Question Bank architecture, including taxonomy tables, questions, internal data, mapping tables, database constraints, lifecycle constraints, row-level security (RLS), triggers, and pgTAP contracts.

## 7. Non-goals

- No Express routers, controllers, or OpenAPI routes.
- No question seed data.
- No frontend code or APIs.
- No Phase 5 interview logic.
- No HTTP search behavior.
- No durable audit-event logging or idempotency implementations for Question Bank actions.

## 8. Architecture checkpoint

1. **Verified baseline:** `1f53d9d` on branch `backend`, CI #100 success.
2. **Existing database conventions:** UUID primary keys (`gen_random_uuid()`), TIMESTAMPTZ for timestamps, lowercase schema names, snake_case identifiers, `_enum` suffix for enum types, cascading deletes for ownership where applicable, restricted deletes for reference data.
3. **Existing active-user helper:** `private.is_active_user()` checks `account_status = 'active'` and `deleted_at IS NULL`.
4. **Existing active-admin helper:** `private.is_active_admin()` checks `role = 'admin'`, `account_status = 'active'`, and `deleted_at IS NULL`.
5. **Existing timestamp trigger helper:** `private.set_updated_at()` updates `updated_at` to `now()`.
6. **Existing UUID convention:** Primary keys use `uuid default gen_random_uuid()`.
7. **Existing enum convention:** Custom types end with `_enum` (e.g., `account_status_enum`, `user_role_enum`).
8. **Existing RLS conventions:** `policy_name_role_action` (e.g., `users_admin_select`), bypassing anonymous access, strict checks against active accounts.
9. **Existing privilege conventions:** `revoke all on public.table from public, anon;` followed by targeted `grant select, insert... to authenticated;` and `grant all to service_role;`.
10. **Existing pgTAP conventions:** Granular test files named `00XX_test_name.sql`, strict use of `plan(N)`, covering schema, privileges, RLS, and logic.
11. **Exact taxonomy columns and limits:**
    - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - `slug` VARCHAR(100) NOT NULL (UNIQUE INDEX ON lower(slug))
    - `name` VARCHAR(100) NOT NULL (UNIQUE INDEX ON lower(name))
    - `description` VARCHAR(500)
    - `display_order` INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)
    - `is_active` BOOLEAN NOT NULL DEFAULT true
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
12. **Exact question columns and limits:**
    - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - `question_text` TEXT NOT NULL CHECK (char_length(trim(question_text)) BETWEEN 10 AND 2000)
    - `category_id` UUID NOT NULL REFERENCES question_categories(id) ON DELETE RESTRICT
    - `difficulty_id` UUID NOT NULL REFERENCES question_difficulties(id) ON DELETE RESTRICT
    - `interview_type_id` UUID NOT NULL REFERENCES question_interview_types(id) ON DELETE RESTRICT
    - `status` public.question_status_enum NOT NULL DEFAULT 'draft'
    - `created_by` UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - `published_at` TIMESTAMPTZ
    - `archived_at` TIMESTAMPTZ
13. **Exact internal-data columns and limits:**
    - `question_id` UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE
    - `reference_answer` TEXT CHECK (char_length(trim(reference_answer)) <= 5000)
    - `evaluation_guidance` JSONB CHECK (jsonb_typeof(evaluation_guidance) = 'object')
    - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
14. **Exact mapping-table columns:**
    - `question_id` UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE
    - `skill_id` (or `topic_id`) UUID NOT NULL REFERENCES public.question_skills(id) ON DELETE RESTRICT
    - `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
    - Primary key: `(question_id, skill_id)`
15. **Exact foreign-key actions:**
    - Taxonomy references: `RESTRICT` (prevents deleting active/inactive taxonomies used by questions).
    - Creator references: `RESTRICT` (prevents deleting a user who created a question).
    - Mapping parent (question): `CASCADE` (if question is deleted, mappings are deleted).
16. **Exact lifecycle constraints:**
    - `draft`: `status = 'draft'`, `published_at IS NULL`, `archived_at IS NULL`.
    - `published`: `status = 'published'`, `published_at IS NOT NULL`, `archived_at IS NULL`.
    - `archived`: `status = 'archived'`, `published_at IS NOT NULL`, `archived_at IS NOT NULL`.
    - Allowed transitions: `draft` -> `published`, `published` -> `archived`, `archived` -> `draft`.
17. **Exact timestamp rules:** Use `private.set_updated_at()` trigger for taxonomies, questions, and internal_data. Mapping tables do not need updated_at since they are immutable association records.
18. **Exact active-taxonomy enforcement:** Implemented via a `BEFORE INSERT OR UPDATE` trigger on `questions` and mapping tables that checks the `is_active` flag of the referenced taxonomies. Publishing a question also checks that all associated taxonomies (including mappings) are active.
19. **Exact taxonomy archival restrictions:** A `BEFORE UPDATE` trigger on taxonomy tables ensures `is_active` cannot be set to `false` if the taxonomy is referenced by any `published` question.
20. **Exact student read policies:**
    - Taxonomies: `SELECT` where `is_active = true` AND `private.is_active_user()`.
    - Questions: `SELECT` where `status = 'published'` AND `private.is_active_user()`.
    - Internal Data: `DENY ALL`.
    - Mappings: `SELECT` where the joined question's `status = 'published'` AND `private.is_active_user()`.
21. **Exact admin write policies:**
    - Taxonomies: `SELECT, INSERT, UPDATE` where `private.is_active_admin()`. (No DELETE privileges on table).
    - Questions: `SELECT, INSERT, UPDATE` where `private.is_active_admin()`. (No DELETE).
    - Internal Data: `SELECT, INSERT, UPDATE` where `private.is_active_admin()`. (No DELETE privileges).
    - Mappings: `SELECT, INSERT, DELETE` where `private.is_active_admin()`. (No UPDATE).
22. **Exact mapping-table policies:** As defined above (Admin can insert/delete; Student can read published).
23. **Exact internal-data isolation:** Separate table (`question_internal_data`) with strictly no student SELECT RLS policies, and no grants for broad deletion.
24. **Exact grants and revocations:**
    - `revoke all on table from public, anon;`
    - `grant select to authenticated;` (plus `insert`, `update`, `delete` only where admins explicitly need them, bounded by RLS).
    - `grant all to service_role;`
25. **Search-index foundation:** A generated `tsvector` column on `questions` using `to_tsvector('english', question_text)`, backed by a GIN index.
26. **Indexing strategy:** Index `status`, `published_at`, `category_id`, `difficulty_id`, `interview_type_id`, and `is_active`/`display_order` for taxonomies. Search vector indexed via GIN.
27. **Migration risk:** Low. This is purely additive. It adds new tables and types but does not mutate existing auth or preference systems.
28. **Rollback and forward-migration considerations:** Forward-only migration; completely cleanly separated from existing structures. Safe to deploy.
29. **Test design:** Using pgTAP in `supabase/tests/0017_phase4_2_question_bank_foundation_contract.sql`. Will assert columns, types, foreign keys, triggers, constraints, RLS behavior for both students and admins, and negative tests for suspended users and anon.
30. **Expected changed files:**
    - `supabase/migrations/20260101000017_create_question_bank_tables.sql`
    - `supabase/tests/0017_phase4_2_question_bank_foundation_contract.sql`
    - `src/persistence/database.types.ts`
    - `docs/backend/phase-4/02-question-bank-database-schema-constraints-rls-foundation.md`

## 9. Migration 17 summary

Creates `question_status_enum`.
Creates 5 taxonomy tables (`question_categories`, `question_difficulties`, `question_interview_types`, `question_skills`, `question_topics`).
Creates `questions` table with `tsvector` and lifecycle constraints.
Creates `question_internal_data` table.
Creates `question_skill_mappings` and `question_topic_mappings` tables.
Creates triggers for `updated_at`, lifecycle enforcement, active-taxonomy enforcement, and archival protection.
Applies RLS and grants.

## 10. Question status type

`CREATE TYPE public.question_status_enum AS ENUM ('draft', 'published', 'archived');`

## 11. Taxonomy tables

Standardized structure using `VARCHAR(100)` for slug/name, UNIQUE INDEX on `lower()`, and `is_active` boolean.

## 12. Questions table

Contains `status`, timestamps, foreign keys to base taxonomies. Limits `question_text` (10-2000 chars) via `CHECK`. Cannot alter `created_by` after insert via trigger/constraint. `tsvector` generated column.

## 13. Internal-data table

One-to-one to `questions`. No `SELECT` for students.

## 14. Skill mapping

Composite primary key `(question_id, skill_id)`. RESTRICT delete on skill, CASCADE on question.

## 15. Topic mapping

Composite primary key `(question_id, topic_id)`. RESTRICT delete on topic, CASCADE on question.

## 16. Foreign keys

Detailed in checkpoint (RESTRICT for taxonomy lookups and creator, CASCADE for question deletion propagation to mappings and internal data).

## 17. Constraints

`CHECK` constraints for text bounds, positive numbers, and explicit `NOT NULL` fields.

## 18. Lifecycle enforcement

A `BEFORE UPDATE` trigger function `private.enforce_question_lifecycle()` will manage `published_at` and `archived_at` timestamps strictly based on `status` transitions, rejecting invalid transitions like `archived -> published`.

## 19. Timestamp behavior

Using `private.set_updated_at()` trigger for `updated_at` columns, ignoring no-op updates via PostgreSQL `WHEN (OLD.* IS DISTINCT FROM NEW.*)`.

## 20. Taxonomy activity enforcement

A set of `BEFORE INSERT OR UPDATE` triggers to ensure questions and mappings only link to `is_active = true` taxonomies (unless just saving a draft, where inactive is allowed, but publishing will block). Publishing a question validates all taxonomy links. Deactivating a taxonomy checks if it is used by any `published` question and blocks it if so.

## 21. Search index

`question_text_search tsvector generated always as (to_tsvector('english', question_text)) stored`, with `CREATE INDEX idx_questions_search ON public.questions USING GIN (question_text_search)`.

## 22. Supporting indexes

Indexes on foreign keys, `status`, `published_at`, `display_order`, and `is_active`.

## 23. RLS overview

Enabled on all 9 tables. All use `private.is_active_user()` for students and `private.is_active_admin()` for admins.

## 24. Taxonomy RLS

- Student: `SELECT` where `is_active = true`.
- Admin: `SELECT`, `INSERT`, `UPDATE` all.

## 25. Question RLS

- Student: No direct table access. Restricted to `public.published_questions` secure view.
- Admin: `SELECT`, `INSERT`, `UPDATE` all.

## 26. Internal-data RLS

- Student: No access.
- Admin: `SELECT`, `INSERT`, `UPDATE` all.

## 27. Mapping RLS

- Student: `SELECT` where `EXISTS (SELECT 1 FROM published_questions WHERE id = question_id)`.
- Admin: `SELECT`, `INSERT`, `DELETE` all.

## 28. Grants

- `GRANT SELECT, INSERT, UPDATE ON TABLE TO authenticated;` (DELETE granted only on mapping tables to authenticated).

## 29. Revocations

`REVOKE ALL ON TABLE FROM public, anon;`

## 30. SECURITY DEFINER review

New trigger functions will use `SECURITY DEFINER` and `SET search_path = ''` to safely query taxonomies/questions to enforce rules, preventing users from bypassing lifecycle constraints. `REVOKE EXECUTE ON FUNCTION FROM public, anon, authenticated`.

## 31. Direct Data API boundary

Data API strictly enforces the RLS policies and secure views, ensuring students cannot fetch `question_internal_data` or draft/archived questions, nor can they fetch internal columns (like `created_by` or `status`) even via direct `supabase.from('questions').select()` calls.

## 32. pgTAP coverage

Over 80 tests checking exact table structures, columns, constraints, unique indices, lifecycle triggers (draft -> published -> archived -> draft), taxonomy activity enforcement, and specific RLS boundaries for students, admins, and suspended users.

## 33. Generated types

Will be automatically built via `npm run db:types:generate`.

## 34. Validation evidence

Backend CI #101 — Success
Migration 18 test suite passing.

## 35. Files created

- `supabase/migrations/20260101000017_create_question_bank_tables.sql`
- `supabase/migrations/20260101000018_phase4_2_question_bank_foundation_corrections.sql`
- `supabase/migrations/20260101000019_phase4_2_questions_timestamp_correction.sql`
- `supabase/tests/0017_phase4_2_question_bank_foundation_contract.sql`
- `supabase/tests/0018_phase4_2_question_bank_corrections_contract.sql`
- `supabase/tests/0019_phase4_2_questions_timestamp_contract.sql`
- `docs/backend/phase-4/02-question-bank-database-schema-constraints-rls-foundation.md`

## 36. Files modified

- `src/persistence/database.types.ts`

## 37. Files deleted

None.

## 38. Risks

Low. Ensuring exact state transitions for lifecycle requires robust trigger logic.

## 39. Known limitations

Full text search is basic English `tsvector`, which meets requirements but may need tuning for technical jargon later.

## 40. Migration 19 summary

Restores standard `updated_at` behavior for the `questions` table by replacing the verbose trigger condition from Migration 18 with `when (old.* is distinct from new.*)`. Test 0019 explicitly proves the `updated_at` behavior using actual timestamp comparisons for no-ops, real updates, status changes, and forged timestamps.

## 41. Deferred P4.3 work

Student Question Bank HTTP APIs.

## 42. Deferred P4.4 work

Admin Question Bank HTTP APIs.

## 43. Deferred audit/idempotency work

Durable audit logs for question bank operations, generic idempotency middleware.

## 44. Acceptance criteria

- All taxonomies and questions tables exist.
- Internal data is isolated.
- Lifecycle and taxonomy constraints are database-enforced.
- RLS works perfectly across roles and states.
- 0 lint/test/build errors.
- Clean git state.

## 45. Approval checkpoint

(Pending user review)

## 46. Next-subphase boundary

P4.3 Student APIs.
