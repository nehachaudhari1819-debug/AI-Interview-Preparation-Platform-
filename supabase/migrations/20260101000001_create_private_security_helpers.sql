-- Migration 01: Private Security Helpers
-- Creates the private schema, revokes default access, and sets up robust security-definer helpers.

create schema if not exists private;

-- Deny public and anonymous access to the private schema by default
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;


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
