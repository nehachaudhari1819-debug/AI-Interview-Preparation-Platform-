-- Migration 02: Core User Profile
-- Creates the ENUMs, public.users table, and the auth trigger for synchronization.

-- Types
create type public.account_status_enum as enum ('active', 'suspended', 'deletion_pending', 'deleted');
create type public.experience_level_enum as enum ('fresher', 'beginner', 'intermediate', 'advanced');
create type public.user_role_enum as enum ('student', 'admin');

-- Core users table
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email varchar(255) not null unique,
  full_name varchar(100) not null,
  college varchar(150),
  branch varchar(100),
  graduation_year integer check (graduation_year between 2000 and 2100),
  experience_level public.experience_level_enum,
  preferred_roles text[] default '{}',
  bio varchar(500),
  avatar_url text,
  role public.user_role_enum not null default 'student',
  account_status public.account_status_enum not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Indexes
create index idx_users_account_status on public.users(account_status);
create index idx_users_created_at on public.users(created_at);
create index idx_users_role on public.users(role);

-- Attach updated_at trigger
create trigger set_public_users_updated_at
  before update on public.users
  for each row
  execute function private.set_updated_at();

-- Trigger function to synchronize auth.users to public.users securely
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
  _graduation_year integer;
begin
  -- Safely extract and cast metadata without trusting roles or statuses
  _full_name := coalesce((new.raw_user_meta_data->>'fullName'), split_part(new.email, '@', 1));
  _college := new.raw_user_meta_data->>'college';
  _branch := new.raw_user_meta_data->>'branch';
  _graduation_year := (new.raw_user_meta_data->>'graduationYear')::integer;

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

-- Deny public execution of the trigger function
revoke execute on function private.handle_new_auth_user() from public, anon, authenticated;

-- Attach trigger to auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_auth_user();

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
