-- Migration 06: Corrective Hardening for P2.11
-- Addresses remaining security boundary issues from the P2.11 gate review.

-- 1. Restrict update privileges on public.users
revoke update on public.users from authenticated;
grant update (
  full_name,
  college,
  branch,
  graduation_year,
  experience_level,
  preferred_roles,
  bio,
  avatar_url
) on public.users to authenticated;

-- 2. Remove unapproved admin access
drop policy if exists users_admin_select on public.users;
drop policy if exists audit_logs_admin_select on public.audit_logs;
revoke select on public.audit_logs from authenticated;
drop function if exists private.is_active_admin();

-- 3. Ensure audit logs are append-only
revoke all on public.audit_logs from service_role;
grant select, insert on public.audit_logs to service_role;

create or replace function private.prevent_audit_log_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'audit logs are immutable';
end;
$$;

revoke execute on function private.prevent_audit_log_mutation() from public, anon, authenticated;

drop trigger if exists prevent_audit_log_update_delete on public.audit_logs;
create trigger prevent_audit_log_update_delete
before update or delete on public.audit_logs
for each row
execute function private.prevent_audit_log_mutation();

-- 4. Secure signup metadata casting and truncation
-- Replaces the handle_new_auth_user trigger from Migration 02
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _full_name varchar(100);
  _college varchar(150);
  _branch varchar(100);
  _graduation_year_str text;
  _graduation_year integer;
begin
  -- Safely extract and cast metadata without trusting roles or statuses
  -- Truncate text to match column limits
  _full_name := left(coalesce((new.raw_user_meta_data->>'fullName'), split_part(new.email, '@', 1)), 100);
  _college := left(new.raw_user_meta_data->>'college', 150);
  _branch := left(new.raw_user_meta_data->>'branch', 100);
  
  -- Validate numeric expression before casting
  _graduation_year_str := new.raw_user_meta_data->>'graduationYear';
  if _graduation_year_str ~ '^\d+$' then
    _graduation_year := _graduation_year_str::integer;
  else
    _graduation_year := null;
  end if;

  insert into public.users (id, email, full_name, college, branch, graduation_year)
  values (
    new.id,
    new.email,
    _full_name,
    _college,
    _branch,
    _graduation_year
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$;
