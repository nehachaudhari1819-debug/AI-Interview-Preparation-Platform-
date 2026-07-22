begin;
select plan(3);

-- Create a mock user
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', '{"fullName": "Owner User"}');

-- 1. Verify `anon` cannot call `private.is_active_user`
set local role anon;
select throws_ok(
  'select private.is_active_user()',
  'permission denied for schema private',
  'Anon cannot access private schema functions'
);

-- 2. Verify `authenticated` can call `private.is_active_user`
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select results_eq(
  'select private.is_active_user()',
  ARRAY[true],
  'Authenticated active user can evaluate is_active_user() successfully'
);

-- 3. Verify `authenticated` cannot execute `private.set_updated_at` directly
select throws_ok(
  'select private.set_updated_at()',
  'permission denied for function set_updated_at',
  'Authenticated cannot manually trigger set_updated_at'
);

select * from finish();
rollback;
