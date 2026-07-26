begin;
select plan(10);

-- 1. Create a mock user
insert into auth.users (id, email, raw_user_meta_data) values
  ('44444444-4444-4444-4444-444444444444', 'hardening@example.com', '{"fullName": "Harden Test"}');

-- Set up service role context
set local role service_role;
insert into public.audit_logs (actor_user_id, action, resource_type) values
  ('44444444-4444-4444-4444-444444444444', 'CREATE', 'user');

-- 2. Authenticated user update restrictions
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);

select throws_ok(
  'update public.users set email = ''hacked@example.com'' where id = ''44444444-4444-4444-4444-444444444444''',
  'permission denied for table users',
  'Authenticated users cannot update email'
);

select throws_ok(
  'update public.users set created_at = now() where id = ''44444444-4444-4444-4444-444444444444''',
  'permission denied for table users',
  'Authenticated users cannot update created_at'
);

select throws_ok(
  'update public.users set role = ''admin'' where id = ''44444444-4444-4444-4444-444444444444''',
  'permission denied for table users',
  'Authenticated users cannot update role'
);

select throws_ok(
  'update public.users set account_status = ''suspended'' where id = ''44444444-4444-4444-4444-444444444444''',
  'permission denied for table users',
  'Authenticated users cannot update account_status'
);

-- 3. Authenticated user cannot select audit logs
select throws_ok(
  'select * from public.audit_logs',
  'permission denied for table audit_logs',
  'Authenticated users cannot select audit logs'
);

-- 4. Service role audit log mutation restrictions
set local role service_role;

select throws_ok(
  'update public.audit_logs set action = ''HACKED''',
  'permission denied for table audit_logs',
  'Service role cannot update audit logs (permission denied)'
);

select throws_ok(
  'delete from public.audit_logs',
  'permission denied for table audit_logs',
  'Service role cannot delete audit logs (permission denied)'
);

-- 5. Audit logs remain insertable
select lives_ok(
  'insert into public.audit_logs (actor_user_id, action, resource_type) values (''44444444-4444-4444-4444-444444444444'', ''READ'', ''user'')',
  'Audit logs remain insertable'
);

-- 6. Invalid graduationYear metadata does not break signup
set local role postgres;

select lives_ok(
  'insert into auth.users (id, email, raw_user_meta_data) values (''55555555-5555-5555-5555-555555555555'', ''invalid_grad@example.com'', ''{"fullName": "Invalid Grad", "graduationYear": "not-a-number"}'' )',
  'Invalid graduationYear metadata does not break signup'
);

select results_eq(
  'select graduation_year from public.users where id = ''55555555-5555-5555-5555-555555555555''',
  ARRAY[null::integer],
  'graduation_year defaults to null for invalid inputs'
);


select * from finish();
rollback;
