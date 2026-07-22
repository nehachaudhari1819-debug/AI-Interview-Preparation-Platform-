# RLS Policy Reference

Row-Level Security (RLS) is enabled on all tables in the `public` schema. Anonymous access is strictly denied by default.

## `public.users`
| Policy Name | Target | Operation | Constraint (USING / WITH CHECK) |
|-------------|--------|-----------|----------------------------------|
| `users_owner_select` | `authenticated` | SELECT | User ID matches `auth.uid()`, status is active, deleted_at is null. |
| `users_owner_update` | `authenticated` | UPDATE | User ID matches `auth.uid()`, cannot change role, status, or ID. |
| `users_admin_select` | `authenticated` | SELECT | `private.is_active_admin()` is true. |

## `public.idempotency_records`
| Policy Name | Target | Operation | Constraint (USING / WITH CHECK) |
|-------------|--------|-----------|----------------------------------|
| N/A | N/A | ALL | Completely denied for clients. System (service_role) only. |

## `public.audit_logs`
| Policy Name | Target | Operation | Constraint (USING / WITH CHECK) |
|-------------|--------|-----------|----------------------------------|
| `audit_logs_admin_select`| `authenticated` | SELECT | `private.is_active_admin()` is true. |
| N/A | N/A | INSERT | Completely denied for clients. System appends via service_role. |
| N/A | N/A | UPDATE/DELETE | Completely denied for all roles (including Admin). |
