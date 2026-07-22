-- Migration 03: System Persistence Tables
-- Creates public.idempotency_records and public.audit_logs

create type public.idempotency_status_enum as enum ('processing', 'completed', 'failed');

create table if not exists public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  idempotency_key varchar(255) not null,
  operation varchar(100) not null,
  request_hash varchar(64) not null,
  status public.idempotency_status_enum not null default 'processing',
  resource_type varchar(100),
  resource_id uuid,
  response_status integer,
  response_body jsonb,
  locked_until timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint to prevent simultaneous identical keys
alter table public.idempotency_records
  add constraint idempotency_records_user_op_key_unique unique (user_id, operation, idempotency_key);

create index idx_idempotency_expires_at on public.idempotency_records(expires_at);
create index idx_idempotency_user on public.idempotency_records(user_id);

create trigger set_idempotency_updated_at
  before update on public.idempotency_records
  for each row
  execute function private.set_updated_at();


-- Audit logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type varchar(50) not null default 'user',
  action varchar(100) not null,
  resource_type varchar(100) not null,
  resource_id uuid,
  metadata jsonb default '{}'::jsonb,
  request_id uuid,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_actor on public.audit_logs(actor_user_id, created_at);
create index idx_audit_logs_resource on public.audit_logs(resource_type, resource_id);
create index idx_audit_logs_action on public.audit_logs(action);
