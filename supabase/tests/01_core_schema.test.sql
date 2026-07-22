begin;
select plan(28);

-- 1. Schemas
select has_schema('public');
select has_schema('private');

-- 2. Tables
select has_table('public', 'users', 'users table exists');
select has_table('public', 'idempotency_records', 'idempotency_records table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');

-- 3. Core Columns
select has_column('public', 'users', 'id', 'users.id exists');
select has_column('public', 'users', 'email', 'users.email exists');
select has_column('public', 'users', 'role', 'users.role exists');
select has_column('public', 'users', 'account_status', 'users.account_status exists');

select has_column('public', 'idempotency_records', 'idempotency_key', 'idempotency_records.idempotency_key exists');
select has_column('public', 'idempotency_records', 'status', 'idempotency_records.status exists');

select has_column('public', 'audit_logs', 'actor_user_id', 'audit_logs.actor_user_id exists');
select has_column('public', 'audit_logs', 'action', 'audit_logs.action exists');

-- 4. Foreign Keys
select col_is_fk('public', 'users', 'id', 'users.id is a foreign key to auth.users');
select col_is_fk('public', 'idempotency_records', 'user_id', 'idempotency_records.user_id is a foreign key');
select col_is_fk('public', 'audit_logs', 'actor_user_id', 'audit_logs.actor_user_id is a foreign key');

-- 5. Primary Keys
select col_is_pk('public', 'users', 'id', 'users.id is a primary key');
select col_is_pk('public', 'idempotency_records', 'id', 'idempotency_records.id is a primary key');

-- 6. Indexes
select has_index('public', 'users', 'idx_users_account_status', 'idx_users_account_status exists');
select has_index('public', 'idempotency_records', 'idx_idempotency_expires_at', 'idx_idempotency_expires_at exists');
select has_index('public', 'audit_logs', 'idx_audit_logs_action', 'idx_audit_logs_action exists');

-- 7. Constraints
select col_has_check('public', 'users', 'graduation_year', 'graduation_year has check constraint');

-- 8. Functions
select has_function('private', 'is_active_user', 'private.is_active_user exists');
select has_function('private', 'set_updated_at', 'private.set_updated_at exists');
select has_function('private', 'handle_new_auth_user', 'private.handle_new_auth_user exists');

-- 9. RLS Enabled
select table_privs_are('public', 'users', 'anon', ARRAY[]::text[], 'anon has no privileges on users');
select table_privs_are('public', 'idempotency_records', 'anon', ARRAY[]::text[], 'anon has no privileges on idempotency_records');
select table_privs_are('public', 'audit_logs', 'anon', ARRAY[]::text[], 'anon has no privileges on audit_logs');

select * from finish();
rollback;
