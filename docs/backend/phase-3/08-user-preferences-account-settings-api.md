# Phase 3.8: User Preferences & Account Settings API

**Phase:** 3.8
**Status:** IMPLEMENTED — REVIEW PENDING
**Authorized Branch:** backend
**Approved Baseline:** 04b5654

---

## 1. Scope

P3.8 delivers the secure backend account-settings resource that allows an authenticated active user to retrieve and update their own supported platform preferences.

**In scope:**

- Dedicated `public.user_preferences` table
- Automatic provisioning for existing and new users
- Row-Level Security for preferences
- GET `/api/v1/users/me/preferences`
- PATCH `/api/v1/users/me/preferences`
- Durable auditing via DB triggers
- Safe validation and error handling

**Non-goals:**

- Email or password changes
- MFA or Session management
- Feature-specific UI settings (e.g., Theme/Dark mode)
- Profile updates

## 2. Architecture Checkpoint

- **Database Model**: `public.user_preferences` linked to `public.users(id)`.
- **Provisioning**:
  - Backfilled using `INSERT ... SELECT` on migration.
  - Future users provisioned via a new trigger on `public.users` after insert.
- **RLS**: Policies check `user_id = auth.uid() AND private.is_active_user()`.
- **Audit**: `private.audit_user_preferences_update()` detects actual changes and issues `USER_PREFERENCES_UPDATED`.
- **API**: Uses the authenticated user-scoped Supabase client. Rate limit `USER_STANDARD`.

## 3. Database Schema

- Table: `public.user_preferences`
- Primary Key: `user_id` (UUID, FK to `public.users(id)` ON DELETE CASCADE)
- `locale`: VARCHAR(35) NOT NULL DEFAULT 'en'
- `time_zone`: VARCHAR(64) NOT NULL DEFAULT 'UTC'
- `practice_reminders_enabled`: BOOLEAN NOT NULL DEFAULT false
- `weekly_progress_summary_enabled`: BOOLEAN NOT NULL DEFAULT false
- `product_updates_enabled`: BOOLEAN NOT NULL DEFAULT false
- `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
- `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

## 4. Database Migrations

- Migration `20260101000015_phase3_8_user_preferences_account_settings.sql` provisions the schema, RLS policies, audit triggers, and backfills existing users.
- A trigger on `public.users` automatically provisions the preferences row upon user insertion.

## 5. Row-Level Security (RLS)

- **SELECT/UPDATE**: Allowed only when `user_id = auth.uid()` AND `private.is_active_user()`.
- **INSERT/DELETE**: Denied for all client roles. Handled solely by DB triggers.
- **Bypass**: Suspended or deletion-pending users are blocked by the `private.is_active_user()` check.

## 6. Durable Audit Mechanism

- **Trigger**: `AFTER UPDATE ON public.user_preferences FOR EACH ROW`.
- **Execution**: `private.audit_user_preferences_update()`.
- **Behavior**:
  - Compares OLD and NEW values.
  - If no changes, returns NEW (no-op).
  - If changes detected, inserts into `public.audit_logs`.
  - Event: `USER_PREFERENCES_UPDATED`.
  - Metadata: `{"changedFields": ["locale", "timeZone"]}` (Sorted, keys only, NO values).

## 7. User Preferences API Contracts

### GET `/api/v1/users/me/preferences`

- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 200 OK with `data: { locale, timeZone, ... }`. No internal fields (e.g. `userId`) returned.
- **Cache-Control**: `no-store`

### PATCH `/api/v1/users/me/preferences`

- **Auth Required**: Yes
- **Headers**: `Authorization: Bearer <token>`
- **Body**: Partial updates allowed. Validated strictly (no unknown fields).
- **Response**: 200 OK with updated data.
- **Cache-Control**: `no-store`

## 8. Validation

- Zod schemas enforce type strictness.
- Empty patches are rejected.
- Invalid Locales or Timezones are rejected.
- Injection of ownership fields (e.g. `userId`) is blocked.

## 9. Test Coverage

- **Database Contract Tests**: Executed via pgTAP in `0015_phase3_8_user_preferences_contract.sql`. Checks RLS, defaults, trigger logic, and cross-user isolation.
- **Unit Tests**: Full coverage for Controller, Service, Normalizers, and Mappers.
- **Integration Tests**: Tests authentication, valid/invalid patches, active account middleware, and error mappings via Supertest and Jest.
- **Real Supabase E2E Tests**: Tests full flow against real Supabase instance, including cross-user checks, DB triggers for audits, and Data API security isolation.
- **Security Tests**: Ensures Express router boundaries prevent cross-user ID injection.

## 10. Acceptance Criteria

- Database triggers reliably prevent audits for no-op preference updates.
- End-to-end OpenAPI documentation accurately reflects the preference contracts.
- E2E tests prove updated_at behaviors correctly distinguish between no-op and actual updates.
- Database documentation remains accurate and aligns exactly with migrations.

## 11. Next-Phase Boundary

- This completes Phase 3.8.
- No work is authorized for Phase 4 or beyond.
- Final validation and deployment checks are required before moving to the next phase.

---

## 12. Approval Checkpoint

Please review the source diff, test results, and this document.
**STATUS:** IMPLEMENTED — REVIEW PENDING
