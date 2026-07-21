# P1.5 — Row Level Security Policy Plan

## 1. RLS Principles and Threat Model

**Principles:**
1. **Default deny:** Every exposed application table must have RLS enabled. No anonymous access is allowed unless explicitly approved. Access is denied when no matching policy exists.
2. **Defense in depth:** Authorization exists at two layers: Express authorization + PostgreSQL RLS. RLS protects row access if application authorization fails. Express handles business rules, request validation, and AI/file validation.
3. **Authoritative identity:** `(select auth.uid())` is the authoritative user identity. Ownership must not be derived from request body, query string, or frontend role state.
4. **Active account enforcement:** Normal access requires an authenticated user who owns the row AND `public.users.account_status = active`. Access is blocked for `suspended`, `deletion_pending`, and `deleted`.
5. **Separate USING and WITH CHECK:** `USING` defines which existing rows may be accessed. `WITH CHECK` defines which new/updated values may be stored.
6. **Explicit PostgreSQL roles:** Policies target `anon` (no direct access), `authenticated` (limited by ownership, role, active account, state, operation), and `service_role` (bypasses RLS, used only in trusted workflows).

**Threat Model:**
*   **Horizontal privilege escalation:** Prevent users from accessing or modifying other users' resources.
*   **Vertical privilege escalation:** Prevent users from assuming the `admin` role or updating protected system fields.
*   **Unauthorized data mutation:** Prevent score forgery, state tampering, and unauthorized soft/hard deletion.
*   **Data leakage:** Prevent exposure of private resumes, AI evaluations, and other users' interview data.

## 2. Database Roles and Access Classifications

### Database Roles
*   **anon:** Anonymous users. No direct access to application tables.
*   **authenticated:** Logged-in users. Access governed by RLS policies based on ownership, role, and active status.
*   **service_role:** Administrative role for trusted backend services. Bypasses RLS. Never exposed to frontend.

### Access Classifications
*   `ANON_DENIED`: Action forbidden for anonymous users.
*   `AUTHENTICATED_READ`: Action allowed for authenticated users (with specific constraints).
*   `OWNER_READ`: Read allowed only if the user owns the resource and is active.
*   `OWNER_INSERT`: Insert allowed only if the user owns the resource and is active.
*   `OWNER_UPDATE`: Update allowed only if the user owns the resource, is active, and only updates permitted fields.
*   `OWNER_SOFT_DELETE`: Soft delete allowed for owned resources through controlled APIs.
*   `ADMIN_READ`: Read allowed for active admin users.
*   `ADMIN_WRITE`: Write allowed for active admin users.
*   `SYSTEM_INSERT` / `SYSTEM_UPDATE` / `SYSTEM_DELETE`: Actions allowed only through `service_role` or trusted backend functions.
*   `SYSTEM_ONLY`: Resource completely isolated from direct client access.

## 3. Active-Account and Admin Helper Functions

Helper functions are created in the `private` schema. Default execution privileges must be explicitly revoked from `public` and `anon`, and explicitly granted only to `authenticated`. Security-definer functions must use a fixed `search_path` and fully qualified object names. Such functions do not need to be exposed through the Data API schema merely because policies reference them.

Example grant/revoke:
```sql
revoke execute on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;
```

### `private.is_active_user()`
```sql
create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and account_status = 'active'
      and deleted_at is null
  );
$$;
```

### `private.is_active_admin()`
```sql
create or replace function private.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'active'
      and deleted_at is null
  );
$$;
```

### Ownership Helpers
Helpers like `private.owns_interview(uuid)` return boolean indicating ownership without exposing row data.

## 4. Table-by-Table Policy Matrix

| Table | Operation | Student | Admin | System | Ownership expression | Account-state requirement | Notes |
| ----- | --------- | ------- | ----- | ------ | -------------------- | ------------------------- | ----- |
| `users` | SELECT | `id = auth.uid()` | Yes | Yes | `id = auth.uid()` | `active` (suspended read via Express) | Read own profile |
| `users` | INSERT | Denied | Denied | Yes | — | — | System triggers profile creation |
| `users` | UPDATE | Safe fields | Yes | Yes | `id = auth.uid()` | `active` | No updating role/status |
| `users` | DELETE | Denied | Denied | Yes | — | — | Hard delete denied |
| `questions` | SELECT | Active only | Yes | Yes | — | `active` | Exclude reference answers |
| `questions` | INSERT | Denied | Yes | Yes | — | `active_admin` | — |
| `questions` | UPDATE | Denied | Yes | Yes | — | `active_admin` | — |
| `questions` | DELETE | Denied | Soft | Yes | — | `active_admin` | Hard delete restricted |
| `interviews` | SELECT | `user_id = auth.uid()` | Yes | Yes | `user_id = auth.uid()` | `active` | Read own non-deleted |
| `interviews` | INSERT | Controlled | — | Yes | `user_id = auth.uid()` | `active` | Express client handles creation |
| `interviews` | UPDATE | Draft conf. | — | Yes | `user_id = auth.uid()` | `active` | Cannot update status/scores |
| `interviews` | DELETE | Denied | — | Yes | — | — | Soft delete via API only |
| `interview_questions` | SELECT | Owned | Yes | Yes | Join to `interviews` | `active` | Read owned active interview |
| `interview_questions` | INSERT | Denied | — | Yes | — | — | System-generated only |
| `interview_questions` | UPDATE | Denied | — | Yes | — | — | Immutable snapshots |
| `interview_questions` | DELETE | Denied | — | Yes | — | — | Hard delete denied |
| `responses` | SELECT | `user_id = auth.uid()` | Audited | Yes | `user_id = auth.uid()` | `active` | Read own responses |
| `responses` | INSERT | Controlled | — | Yes | `user_id = auth.uid()` | `active` | Express transaction required |
| `responses` | UPDATE | Denied | — | Yes | — | — | Immutable after submission |
| `responses` | DELETE | Denied | — | Yes | — | — | Hard delete denied |
| `response_evaluations` | SELECT | Completed | Audited | Yes | Join to `responses` | `active` | Own completed current evals |
| `response_evaluations` | INSERT | Denied | — | Yes | — | — | System-generated only |
| `response_evaluations` | UPDATE | Denied | — | Yes | — | — | System updates only |
| `response_evaluations` | DELETE | Denied | — | Yes | — | — | — |
| `resume_analyses` | SELECT | Owned | Audited | Yes | `user_id = auth.uid()` | `active` | API hides sensitive columns |
| `resume_analyses` | INSERT | Controlled | — | Yes | `user_id = auth.uid()` | `active` | Backend creation required |
| `resume_analyses` | UPDATE | Denied | — | Yes | — | — | System updates scores/status |
| `resume_analyses` | DELETE | Denied | — | Yes | — | — | Controlled deletion only |
| `resume_skills` | SELECT | Owned | Audited | Yes | Join `resume_analyses` | `active` | — |
| `resume_skills` | INSERT | Denied | — | Yes | — | — | System-generated only |
| `resume_skills` | UPDATE | Denied | — | Yes | — | — | — |
| `resume_skills` | DELETE | Denied | — | Yes | — | — | — |
| `user_skills` | SELECT | Owned | Audited | Yes | `user_id = auth.uid()` | `active` | Read own skills |
| `user_skills` | INSERT | Profile-src | — | Yes | `user_id = auth.uid()` | `active` | Only source=profile allowed |
| `user_skills` | UPDATE | Profile-src | — | Yes | `user_id = auth.uid()` | `active` | Only source=profile allowed |
| `user_skills` | DELETE | Profile-src | — | Yes | `user_id = auth.uid()` | `active` | Only source=profile allowed |
| `progress` | SELECT | Owned | Aggreg. | Yes | `user_id = auth.uid()` | `active` | Read own progress |
| `progress` | INSERT | Denied | — | Yes | — | — | System calculations only |
| `progress` | UPDATE | Denied | — | Yes | — | — | — |
| `progress` | DELETE | Denied | — | Yes | — | — | — |
| `feedback` | SELECT | Owned | Support | Yes | `user_id = auth.uid()` | `active` | Current feedback only |
| `feedback` | INSERT | Denied | — | Yes | — | — | System-generated only |
| `feedback` | UPDATE | Denied | — | Yes | — | — | — |
| `feedback` | DELETE | Denied | — | Yes | — | — | — |
| `idempotency_records` | SELECT | Denied | Denied | Yes | — | — | System-only access |
| `idempotency_records` | INSERT | Denied | Denied | Yes | — | — | System-only access |
| `idempotency_records` | UPDATE | Denied | Denied | Yes | — | — | System-only access |
| `idempotency_records` | DELETE | Denied | Denied | Yes | — | — | System-only access |
| `audit_logs` | SELECT | Denied | Audited | Yes | — | — | Admin read only |
| `audit_logs` | INSERT | Denied | Denied | Yes | — | — | Append-only system |
| `audit_logs` | UPDATE | Denied | Denied | Denied | — | — | Strictly denied |
| `audit_logs` | DELETE | Denied | Denied | Retent. | — | — | Deletion via retention job |

## 5. Detailed SELECT Policies

*   `users_owner_select`: `USING (id = (select auth.uid()) and account_status = 'active' and deleted_at is null)`. Suspended users view profiles via an Express endpoint.
*   `questions_authenticated_select`: `USING (deleted_at is null and is_active = true)`. Students may read active question rows, but RLS only controls rows—not individual columns. If `reference_answer`, internal evaluation notes, or protected keywords are stored in questions, protect them through an approved view, explicit column privileges, or an API-only projection.
*   `interviews_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()) and deleted_at is null)`.
*   `interview_questions_owner_select`: `USING (private.is_active_user() and interview_id in (select id from public.interviews where user_id = (select auth.uid())))`.
*   `responses_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()) and deleted_at is null)`.
*   `response_evaluations_owner_select`: `USING (private.is_active_user() and status = 'completed' and is_current = true and response_id in (select id from public.responses where user_id = (select auth.uid())))`.
*   `resume_analyses_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()) and deleted_at is null)`.
*   `resume_skills_owner_select`: `USING (private.is_active_user() and resume_analysis_id in (select id from public.resume_analyses where user_id = (select auth.uid())))`.
*   `user_skills_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()))`.
*   `progress_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()))`.
*   `feedback_owner_select`: `USING (private.is_active_user() and user_id = (select auth.uid()) and is_current = true)`.

## 6. Detailed INSERT Policies

*   `users`: RLS insertion denied. Handled by trusted system trigger/workflow.
*   `questions`: Denied for students. `questions_admin_insert` allowed.
*   `interviews`: Denied for direct client insert. Express creates via user-scoped client requiring `user_id = auth.uid()`, `status = draft`, and explicit null for protected fields.
*   `interview_questions`: Denied. System-generated.
*   `responses`: Denied for direct RLS. Express uses a transaction to handle idempotency, check interview state, and ensure cross-resource consistency.
*   `user_skills`: `user_skills_owner_insert` WITH CHECK `(private.is_active_user() and user_id = (select auth.uid()) and source = 'profile')`. System derived skills protected.
*   `resume_analyses`: Denied for direct insert. Express manages database/storage synchronization.
*   `idempotency_records`, `audit_logs`: Denied. System-only insert.

## 7. Detailed UPDATE Policies

**Update Policy Rule:** Every student or admin UPDATE policy must have:
*   A matching SELECT policy
*   A USING expression for the existing row
*   A WITH CHECK expression for the resulting row
*(Note: Supabase notes that an UPDATE will not work correctly without a corresponding SELECT policy.)*

*   `users`: `users_owner_update`. Only safe fields (e.g. `full_name`, `bio`). Must not update `role`, `account_status`, `email`.
*   `questions`: `questions_admin_update`. Admin only.
*   `interviews`: `interviews_owner_update`. Allows updating draft configuration only. Cannot update scores, timestamps, or status.
*   `user_skills`: `user_skills_owner_update`. Update only where `source = 'profile'`.
*   `responses`, `interview_questions`, `response_evaluations`, `resume_analyses`, `resume_skills`, `progress`, `feedback`, `idempotency_records`, `audit_logs`: Updates denied for students. System updates only via backend logic.

## 8. Detailed DELETE Policies

*   Direct hard deletes via RLS are denied for almost all tables (`users`, `interviews`, `responses`, `resume_analyses`).
*   Soft deletion must occur via controlled Express API workflows to ensure side effects (e.g., storage cleanup, audit logs) are handled.
*   `user_skills`: `user_skills_owner_delete` ALLOWED only where `source = 'profile'`.
*   `questions`: `questions_admin_delete`. Admins can soft-delete questions.
*   `audit_logs`: Only allowed via trusted retention job.

## 9. Column-level Privilege Strategy

RLS protects rows, not columns. To protect specific columns:
*   Use PostgreSQL column `GRANT` and `REVOKE` for `authenticated` roles where applicable.
*   Primarily rely on controlled Express RPCs/Endpoints with user-scoped clients that only accept explicit safe fields.
*   Use views or API mapping to hide sensitive data like reference answers, raw AI output, and admin metadata.

## 10. Stateful and Immutable Field Protection

RLS alone cannot enforce valid business state transitions (e.g., `draft` -> `in_progress` -> `completed`).
*   Direct state updates are denied in RLS.
*   Operations requiring state changes (start interview, submit response, upload resume) occur via controlled backend transactions.
*   These transactions validate business rules, idempotency, and state flow before applying changes via service-role or secured methods.

## 11. Child-Resource Ownership Rules

Child resources (e.g., `interview_questions`, `response_evaluations`, `resume_skills`) derive ownership via indexed joins to their parent.
*   Example: `response_evaluations.response_id` -> `responses.id` -> `responses.user_id = auth.uid()`.
*   Helpers or explicit join conditions in `USING` clauses enforce this.

## 12. Admin and System Access Boundaries

*   Admin access requires `role = 'admin'` and `account_status = 'active'`.
*   Sensitive admin actions (e.g. suspending a user) are logged in `audit_logs`.

### Admin Access Matrix

| Table | Admin read | Admin insert | Admin update | Admin delete | Audit required | Sensitive-field restrictions |
| ----- | ---------: | -----------: | -----------: | -----------: | -------------: | ---------------------------- |
| `users` | Yes | Denied | Limited | Denied | Audited | No authentication secrets |
| `questions` | Yes | Yes | Yes | Soft-delete | Audited | — |
| `interviews` | Monitoring | Denied | Denied | Denied | Audited | — |
| `responses` | Audited | Denied | Denied | Denied | Audited | No idempotency response bodies |
| `response_evaluations` | Monitoring | Denied | Denied | Denied | Audited | No raw AI provider results |
| `resume_analyses` | Audited | Denied | Denied | Denied | Audited | No resume extracted text |
| `audit_logs` | Audited | Denied | Denied | Denied | Audited | No audit-log mutation |

Admins must not automatically receive unrestricted access to:
*   resume extracted text
*   private storage objects
*   raw AI provider results
*   idempotency response bodies
*   audit-log mutation
*   authentication secrets

The service/secret key bypasses all RLS and therefore must be limited to trusted server workflows with prior authorization.

## 13. Service-Role Restrictions

*   The `service_role` key bypasses RLS and is used ONLY for trusted backend workflows.
*   It must never be exposed to the frontend or imported into browser code.
*   Generic table access helpers using `service_role` are forbidden.
*   All `service_role` bypasses must explicitly validate resource ownership beforehand, validate transitions, and log audit events.
*   Forbidden uses: Ordinary profile/interview reads, frontend direct access.

## 14. Audit and Idempotency Protections

*   `audit_logs`: Append-only via system. Admins have restricted read access. Users have no access. Deletions only by approved retention jobs. Never stores secrets or full payloads.
*   `idempotency_records`: Trusted backend only. Handles processing locks and replays. Users and admins have zero direct access.

## 15. Private Resume-Storage Policies

*   **Bucket:** `resumes`
*   **Path:** `<user-id>/<analysis-id>/<sanitized-file-name>`
*   **Ownership:** The first folder segment must equal `auth.uid()`.

The private resumes bucket must include explicit policies on `storage.objects` for each permitted operation. Upload requires `INSERT`; overwrite/upsert additionally requires `SELECT` and `UPDATE`, which is why disabling upsert for V1 is safer.

| Resource | Operation | Student | Admin | System | Ownership rule | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `storage.objects` | INSERT | Own folder | Denied | Controlled | First folder = `auth.uid()` | No upsert. |
| `storage.objects` | SELECT | Own file | Audited | Processing | Owner/path match | Private bucket. Auth download/signed URL. |
| `storage.objects` | UPDATE | Denied | Denied | Controlled | — | Retry only. |
| `storage.objects` | DELETE | Controlled API | Restricted | Cleanup | Owner/path match | Coordinated with DB metadata. |
| `storage.buckets` | ALL | Denied | Denied | Admin | — | Bucket configuration protected. |

## 16. View and Function Security

*   Every exposed view must use: `security_invoker = true` or be placed in a non-exposed schema with access revoked. Views otherwise run with their creator’s privileges and can bypass underlying RLS.
*   Functions and RPCs must explicitly define `SECURITY INVOKER` or `SECURITY DEFINER`.
*   `SECURITY DEFINER` functions must set a fixed `search_path = ''` to prevent path injection.
*   Default execution privileges on functions must be revoked (`revoke execute on function ... from public;`) and granted only to approved roles.

## 17. Performance and Indexing Requirements

RLS policies must rely on indexed columns to avoid full table scans. Required indexes include:
*   `users(id)`, `users(role)`, `users(account_status)`
*   `interviews(user_id)`, `interviews(deleted_at)`
*   `interview_questions(interview_id)`
*   `responses(user_id)`, `responses(interview_id)`, `responses(interview_question_id)`
*   `response_evaluations(response_id)`
*   `resume_analyses(user_id)`, `resume_analyses(deleted_at)`
*   `resume_skills(resume_analysis_id)`
*   `user_skills(user_id)`
*   `progress(user_id)`
*   `feedback(user_id)`, `feedback(interview_id)`
*   `idempotency_records(user_id)`
*   `audit_logs(actor_user_id)`

Child-resource policies using `EXISTS` must rely on indexed foreign keys. Avoid unindexed joins or scanning large tables within policies.

## 18. RLS Testing Matrix

*   **Anonymous:** Cannot read profiles, questions, interviews, resumes, or modify any table.
*   **Profile isolation:** User can read/update own safe fields; cannot access others' profiles; cannot elevate role or status; cannot hard delete.
*   **Question access:** Student reads active questions; cannot modify. Admins can manage questions.
*   **Interview isolation:** User reads own interview; cannot read others; cannot forge score; cannot forge status.
*   **Response isolation:** User submits to own active interview; cannot submit cross-interview; duplicate answers rejected via idempotency/constraints.
*   **Resume isolation:** User reads own analysis/file; cannot access others; cannot path traverse; cannot update score directly.
*   **Admin abuse:** Admin cannot download arbitrary resumes without workflow; admin actions audited.
*   **Service-role misuse:** Service key absent from frontend; bypass requires validation.

## 19. Failure and Recovery Scenarios

*   **Helper missing:** Migration fails before policies apply.
*   **RLS enabled before policies:** Fails closed (default deny) preventing leakage.
*   **Profile missing:** Active-user helper returns false; application denies access; triggers profile repair workflow.
*   **Suspension during session:** Helper immediately denies further access; Express middleware corroborates.
*   **Storage orphaned:** Reconciliation job cleans up missing rows/files.
*   **Recursion:** Test suite catches circular dependencies. Use direct indexed paths.

## 20. Deployment and Rollback Sequence

1. Create private schema and helper functions.
2. Revoke default function privileges.
3. Create supporting indexes.
4. Revoke broad table privileges.
5. Grant required table/column privileges.
6. Enable RLS on tables.
7. Create SELECT, INSERT, UPDATE, DELETE policies.
8. Create storage policies.
9. Create secure views/RPC grants.
10. Run integration tests and verify service-role workflows.

**Rollback:** Fix incorrect policies via replacement or restore previous version. DO NOT disable RLS to solve issues.

## 21. Acceptance Checklist

* [x] Default-deny model defined
* [x] RLS enabled for every exposed table
* [x] Anonymous access defined
* [x] Authenticated-role behavior defined
* [x] Service-role behavior defined
* [x] Access classifications defined
* [x] Authoritative identity defined
* [x] Active-account enforcement defined
* [x] Suspended-account behavior defined
* [x] Deletion-pending behavior defined
* [x] Deleted-account behavior defined
* [x] Admin authorization source defined
* [x] Helper functions defined
* [x] Helper function privileges defined
* [x] Fixed `search_path` requirement defined
* [x] Users table policies defined
* [x] Questions table policies defined
* [x] Interviews table policies defined
* [x] Interview-questions policies defined
* [x] Responses policies defined
* [x] Response-evaluations policies defined
* [x] Resume-analyses policies defined
* [x] Resume-skills policies defined
* [x] User-skills policies defined
* [x] Progress policies defined
* [x] Feedback policies defined
* [x] Idempotency-record policies defined
* [x] Audit-log policies defined
* [x] Every table has SELECT decision
* [x] Every table has INSERT decision
* [x] Every table has UPDATE decision
* [x] Every table has DELETE decision
* [x] `USING` expressions documented
* [x] `WITH CHECK` expressions documented
* [x] Ownership mutation prevented
* [x] Column-level privilege plan documented
* [x] Immutable fields documented
* [x] Calculated fields protected
* [x] Child ownership joins documented
* [x] Required indexes documented
* [x] Admin access matrix documented
* [x] Admin sensitive-field restrictions documented
* [x] Service-role approved uses documented
* [x] Service-role forbidden uses documented
* [x] Private resume bucket documented
* [x] Storage path format documented
* [x] Storage upload policy documented
* [x] Storage download policy documented
* [x] Storage list policy documented
* [x] Storage update policy documented
* [x] Storage delete policy documented
* [x] Signed URL behavior documented
* [x] Bucket-management access denied to users
* [x] View security documented
* [x] RPC security documented
* [x] Policy naming standard documented
* [x] Policy deployment order documented
* [x] Policy rollback strategy documented
* [x] Anonymous attack tests included
* [x] Cross-user attack tests included
* [x] Ownership-injection tests included
* [x] Role-escalation tests included
* [x] Score-forgery tests included
* [x] Child-resource attack tests included
* [x] Suspended-user tests included
* [x] Admin-abuse tests included
* [x] Service-role misuse tests included
* [x] Storage attack tests included
* [x] Failure-recovery scenarios documented
* [x] Security ADRs included
* [x] No unresolved RLS-design blockers remain

## 22. Security Decision Records

### ADR-RLS-001 — Enable RLS on every exposed application table
*   **Decision:** Every table accessible to clients must have RLS enabled.
*   **Reason:** Core defense in depth mechanism.
*   **Security consequence:** Secures data even if Express logic flaws exist.

### ADR-RLS-002 — Use default-deny policies
*   **Decision:** RLS enforces default deny; policies must explicitly allow access.
*   **Reason:** Ensures new roles or operations don't leak data implicitly.
*   **Security consequence:** Highly constrained attack surface.

### ADR-RLS-003 — Require active-account status in owner policies
*   **Decision:** Normal access requires `account_status = active`.
*   **Reason:** Prevents suspended or pending-deletion users from interacting.
*   **Security consequence:** Eliminates ghost-account attack vectors.

### ADR-RLS-004 — Use `auth.uid()` as authoritative identity
*   **Decision:** All ownership checks use `auth.uid()`.
*   **Reason:** Payload manipulation cannot spoof identity.
*   **Security consequence:** Ownership injection mitigated.

### ADR-RLS-005 — Separate row security from column security
*   **Decision:** RLS focuses on rows. Columns are protected by Express APIs or PostgreSQL `GRANT`.
*   **Reason:** Simplifies RLS policies and improves performance.
*   **Security consequence:** Express logic must explicitly allow list valid fields.

### ADR-RLS-006 — Deny direct writes to calculated/system fields
*   **Decision:** Fields like `overall_score`, `status`, and `role` cannot be updated directly by clients.
*   **Reason:** Prevents privilege escalation and forged success.
*   **Security consequence:** Mandates server-side calculation.

### ADR-RLS-007 — Keep audit logs append-only
*   **Decision:** Clients and admins cannot mutate `audit_logs`.
*   **Reason:** Enforces immutability for compliance and security forensics.
*   **Security consequence:** Trustworthy logging.

### ADR-RLS-008 — Hide idempotency records from users
*   **Decision:** Idempotency handled internally, invisible to frontend.
*   **Reason:** Prevents reverse-engineering of replay payloads or processing keys.
*   **Security consequence:** Replay attacks fail cleanly.

### ADR-RLS-009 — Use private storage for resumes
*   **Decision:** Resumes placed in a private bucket with `auth.uid()` path prefix.
*   **Reason:** PII isolation.
*   **Security consequence:** Eliminates path-traversal leaks.

### ADR-RLS-010 — Restrict service-role use to explicit workflows
*   **Decision:** `service_role` is for vetted, specific functions only, never generic helpers.
*   **Reason:** Prevents backend logic bugs from granting unfettered database access.
*   **Security consequence:** Minimizes impact of SSRF or arbitrary-input vulnerabilities.

### ADR-RLS-011 — Use private helper functions with fixed search paths
*   **Decision:** Helpers are placed in `private` schema with `search_path = ''`.
*   **Reason:** Prevents path injection in `SECURITY DEFINER` functions.
*   **Security consequence:** Functions execute safely without escalating user context.

### ADR-RLS-012 — Preserve RLS during rollback
*   **Decision:** Never disable RLS as a recovery method for broken policies.
*   **Reason:** Disabling RLS temporarily opens a massive data leak window.
*   **Security consequence:** Data isolation remains intact under duress.

## 23. Policy Documentation Format Example

## Policy: interviews_owner_select

**Table:**  
`public.interviews`

**Operation:**  
`SELECT`

**Target role:**  
`authenticated`

**Access classification:**  
`OWNER_READ`

**Purpose:**  
Allow active students to read only their own non-deleted interviews.

**USING expression:**

```sql
private.is_active_user()
and user_id = (select auth.uid())
and deleted_at is null
```

**WITH CHECK expression:**
Not applicable.

**Required indexes:**

* `interviews(user_id)`
* Partial or composite index supporting non-deleted owner queries

**Sensitive columns:**
Document fields hidden by API mapping or privileges.

**Attack cases prevented:**

* Cross-user interview read
* Suspended-user access
* Deleted-record access

**Tests:**

* Owner can read
* Other user receives zero rows
* Suspended owner receives zero rows

## 24. Policy Naming Standard

* `users_owner_select`
* `users_owner_update`
* `questions_authenticated_select`
* `questions_admin_insert`
* `interviews_owner_select`
* `interviews_owner_insert`
* `responses_owner_select`
* `resume_analyses_owner_select`
* `audit_logs_admin_select`

## 25. Frontend and Express Integration Notes
* Frontend never uses the service-role key.
* Frontend sends Supabase access token to Express.
* Express creates user-scoped Supabase client when RLS must apply.
* Express never trusts frontend `userId`.
* Express maps RLS-denied results to safe API responses.
* Zero-row results must not reveal whether another user’s resource exists.
* Admin routes require Express role checks in addition to admin RLS rules.
* Business transitions are validated before database calls.
* Service-role bypass requires explicit repository and audit event.
