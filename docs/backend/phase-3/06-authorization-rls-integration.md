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

## Testing

Comprehensive testing guarantees the contract:

1. **pgTAP (Database):** Asserts column grants, RPC return values under varying states, and RLS behavior.
2. **Unit Tests (Application):** Asserts the Gateway mapping logic and the middleware error translation logic.
3. **E2E/Integration:** Validates the complete pipeline over HTTP, proving suspended and deleted accounts cannot bypass checks, and that Direct Data API requests are blocked symmetrically.
