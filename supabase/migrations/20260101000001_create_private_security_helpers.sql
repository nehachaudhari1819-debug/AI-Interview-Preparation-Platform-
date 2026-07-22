-- Migration 01: Private Security Helpers
-- Creates the private schema, revokes default access, and sets up robust security-definer helpers.

create schema if not exists private;

-- Deny public and anonymous access to the private schema by default
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

-- 1. Helper: Check if the calling user is an active user
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

-- Secure execution privileges
revoke execute on function private.is_active_user() from public, anon;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_active_user() to service_role;

-- 2. Helper: Check if the calling user is an active admin
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

-- Secure execution privileges
revoke execute on function private.is_active_admin() from public, anon;
grant execute on function private.is_active_admin() to authenticated;
grant execute on function private.is_active_admin() to service_role;

-- 3. Helper: Set updated_at trigger function
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Secure execution privileges (only triggers execute this, but good practice)
revoke execute on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;
