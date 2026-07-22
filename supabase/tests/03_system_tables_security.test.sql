begin;
select plan(8);

-- Create mock auth users
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', '{"fullName": "Owner User"}');

-- Service role inserts some idempotency and audit logs
insert into public.idempotency_records (user_id, idempotency_key, operation, request_hash, expires_at)
values ('11111111-1111-1111-1111-111111111111', 'key123', 'op1', 'hash1', now() + interval '1 day');

insert into public.audit_logs (actor_user_id, action, resource_type)
values ('11111111-1111-1111-1111-111111111111', 'SOME_ACTION', 'user');

-- 1. Test Anon cannot read idempotency records
set local role anon;
select is_empty(
  'select * from public.idempotency_records',
  'Anonymous role cannot read idempotency records'
);

-- 2. Test Anon cannot read audit logs
select is_empty(
  'select * from public.audit_logs',
  'Anonymous role cannot read audit logs'
);

-- 3. Test Authenticated user cannot read idempotency records
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is_empty(
  'select * from public.idempotency_records',
  'Authenticated role cannot read idempotency records'
);

-- 4. Test Authenticated user cannot read audit logs
select is_empty(
  'select * from public.audit_logs',
  'Authenticated role cannot read audit logs'
);

-- 5. Test Authenticated user cannot insert audit logs
select throws_ok(
  'insert into public.audit_logs (actor_user_id, action, resource_type) values (''11111111-1111-1111-1111-111111111111'', ''HACK'', ''user'')',
  'permission denied for table audit_logs',
  'Authenticated user has no insert privilege on audit logs'
);

-- 6. Test Admin can read audit logs
reset role;
update public.users set role = 'admin' where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select isnt_empty(
  'select * from public.audit_logs',
  'Active Admin can read audit logs'
);

-- 7. Test Admin cannot update audit logs
select throws_ok(
  'update public.audit_logs set action = ''HIDDEN''',
  'permission denied for table audit_logs',
  'Admin cannot update audit logs (no privilege)'
);

-- 8. Test Admin cannot read idempotency records
select is_empty(
  'select * from public.idempotency_records',
  'Admin cannot read idempotency records'
);

select * from finish();
rollback;
