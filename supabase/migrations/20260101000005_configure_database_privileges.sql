-- Migration 05: Configure Database Privileges
-- Enforces least privilege across public tables

-- Revoke default public access to the tables
revoke all on public.users from public, anon;
revoke all on public.idempotency_records from public, anon;
revoke all on public.audit_logs from public, anon;

-- Grant access to authenticated users explicitly for tables they need via RLS
-- users table: authenticated can select and update (RLS filters rows/columns)
grant select, update on public.users to authenticated;

-- (Idempotency and audit logs have no grants for anon or authenticated to ensure absolute isolation)
-- Admins need select on audit logs. Since admin is a state, not a PostgreSQL role,
-- we grant select to authenticated, and the RLS policy will filter out non-admins.
grant select on public.audit_logs to authenticated;

-- Service role retains full access bypassing RLS
grant all on public.users to service_role;
grant all on public.idempotency_records to service_role;
grant all on public.audit_logs to service_role;

-- Prevent accidental table creation in public schema by unprivileged users
revoke create on schema public from public, anon, authenticated;
grant create on schema public to service_role;
