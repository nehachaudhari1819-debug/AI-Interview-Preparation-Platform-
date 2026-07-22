-- Migration 04: Enable Core RLS

-- 1. public.users
alter table public.users enable row level security;

-- Anonymous users cannot read users table (default deny is enforced by no policy for anon)

-- Authenticated owner select
create policy users_owner_select on public.users
  for select
  to authenticated
  using (
    id = (select auth.uid())
    and account_status = 'active'
    and deleted_at is null
  );

-- Authenticated owner update (safe fields only)
create policy users_owner_update on public.users
  for update
  to authenticated
  using (
    id = (select auth.uid())
    and account_status = 'active'
    and deleted_at is null
  )
  with check (
    -- Cannot escalate role
    role = 'student'
    -- Cannot change account status
    and account_status = 'active'
    -- Cannot un-delete
    and deleted_at is null
    -- Cannot change ID
    and id = (select auth.uid())
  );

-- Admin select (if needed later) - Admin must be active and not deleted
create policy users_admin_select on public.users
  for select
  to authenticated
  using (
    private.is_active_admin()
  );


-- 2. public.idempotency_records
alter table public.idempotency_records enable row level security;

-- System-only access. Neither anon nor authenticated roles get policies.
-- Express will use service_role for backend workflow execution, which bypasses RLS.
-- Strictly Denied for clients.


-- 3. public.audit_logs
alter table public.audit_logs enable row level security;

-- Admins can read audit logs
create policy audit_logs_admin_select on public.audit_logs
  for select
  to authenticated
  using (
    private.is_active_admin()
  );

-- No insert, update, or delete policies for anon or authenticated.
-- System backend appends via service_role.
