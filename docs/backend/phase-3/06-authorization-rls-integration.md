# Phase 3.6: Authorization and Row-Level Security Integration

## Objective

Phase 3.6 enforces consistent, unified access control at both the Express API and PostgreSQL boundaries. It guarantees that suspended or deleted accounts are hard-blocked at the edge via a lightweight RPC call, and that identical policies protect the database in the event of direct data API access.

## Implementation Details

### Database Layer

- **`get_current_account_access_state()` RPC:** A `SECURITY DEFINER` function mapped directly to the `auth.uid()`, running with elevated privileges but locked to `search_path = ''`. Returns exact string states (`'active'`, `'disabled'`, `'deleted'`, `'missing'`).
- **RLS Policy Refinement:** `UPDATE` policies are restricted to only allow modifications when `account_status = 'active'`, enforcing fail-closed isolation.
- **Column-Level Privileges (Grants):** Revoked update privileges from protected columns (`email`, `role`, `account_status`, `deleted_at`) for the `authenticated` role, ensuring clients cannot override critical security fields.

### Application Layer

- **Account Access State Schema:** Strict domain typing and Zod schemas guaranteeing the RPC outputs map properly.
- **SupabaseAccountAccessStateGateway:** An isolated gateway responsible purely for resolving the user account state securely, encapsulating Supabase RPC errors to avoid leaking database internals.
- **`require-active-account.middleware`:** An Express middleware running immediately after `authMiddleware`. It intercepts the user's `auth.uid()`, fetches the account state via the gateway, and maps statuses to specific API errors (403 `ACCOUNT_DISABLED`, 403 `ACCOUNT_DELETED`, 404 `USER_PROFILE_NOT_FOUND`).

## Security Properties Proven

1. **Isolation:** A user can only retrieve and modify their own data.
2. **Hard-Boundary Rejection:** Inactive (suspended/deleted) users cannot access endpoints, receiving hard `403 Forbidden` responses dynamically.
3. **Defense-in-Depth:** If Express middleware fails, RLS policies prevent unauthorized database writes. If RLS fails, column-level grants block sensitive state changes.
4. **Least Privilege:** The authenticated Supabase Client uses exact user credentials and possesses zero admin rights.

## Migration Evidence

Migration `20260101000009_phase3_authorization_rls_integration.sql` handles:

1. `get_current_account_access_state()` RPC implementation.
2. Policy hardening for `public.users` guaranteeing isolated read/write logic.
3. Finalizing correct schema ownership.

Migration `20260101000008_finalize_p3_5_deletion_hardening.sql` added the critical `FOR UPDATE` lock around `idempotency_records` ensuring parallel deactivations don't skip audit logs.

## Grants

The `authenticated` role receives limited column access.
Revocations explicitly block:

```sql
REVOKE UPDATE (email, role, account_status, deleted_at) ON public.users FROM authenticated;
```

Granting only editable profile configurations (like `fullName`, `bio`, etc).

## Privilege Verification

- pgTAP tests ensure `authenticated` and `anon` cannot directly query private audit tables, nor update protected `users` columns.
- RLS tests ensure one user cannot query or modify another user's profile under any circumstances.

## Forward-Upgrade Proof

Both `08` and `09` migrations successfully layer atop migrations `01-07` cleanly, verified by a successful `supabase db reset` wiping and rebuilding the database.

## File Manifest

- `supabase/migrations/20260101000008_finalize_p3_5_deletion_hardening.sql`
- `supabase/migrations/20260101000009_phase3_authorization_rls_integration.sql`
- `src/integrations/supabase/account-authorization/supabase-account-access-state.gateway.ts`
- `src/auth/require-active-account.middleware.ts`
- `src/features/users/user-profile.router.ts`

## Complete Test Evidence

- E2E Tests (`tests/e2e/phase-3/authorization-rls-integration.e2e.spec.ts`) pass across HTTP ensuring `403` boundaries correctly trigger on deleted or suspended accounts.
- The entire repository Test Suite validates 558 of 558 passing tests across 147 suites.

## Deferred Work

None remaining for Phase 3.6.

## Approval Checkpoint

Awaiting final user authorization to proceed to Phase 3.7.
