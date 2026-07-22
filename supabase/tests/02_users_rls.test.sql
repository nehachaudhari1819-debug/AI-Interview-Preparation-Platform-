begin;
select plan(9);

-- Create mock auth users
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com', '{"fullName": "Owner User"}'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com', '{"fullName": "Other User"}'),
  ('33333333-3333-3333-3333-333333333333', 'suspended@example.com', '{"fullName": "Suspended User"}');

-- The trigger should have created the public.users records. 
-- Let's suspend the suspended user (service role doing this)
update public.users set account_status = 'suspended' where id = '33333333-3333-3333-3333-333333333333';

-- 1. Test Anon cannot read users
set local role anon;
select is_empty(
  'select * from public.users',
  'Anonymous role cannot read profiles'
);

-- 2. Test Authenticated owner can read own profile
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select results_eq(
  'select email from public.users',
  ARRAY['owner@example.com'::varchar],
  'Authenticated user can read their own profile'
);

-- 3. Test Suspended user cannot read own profile (because account_status != active)
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is_empty(
  'select * from public.users',
  'Suspended authenticated user cannot read their own profile'
);

-- 4. Test Authenticated user can update own full_name
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.users set full_name = 'New Name' where id = '11111111-1111-1111-1111-111111111111';
select results_eq(
  'select full_name from public.users',
  ARRAY['New Name'::varchar],
  'Authenticated user can update their safe profile fields'
);

-- 5. Test Authenticated user cannot update another user
update public.users set full_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';
-- Role 2 is unchanged (we check this by resetting to postgres/service_role later)

-- 6. Test Authenticated user cannot elevate their role to admin
select throws_ok(
  'update public.users set role = ''admin'' where id = ''11111111-1111-1111-1111-111111111111''',
  'new row violates row-level security policy for table "users"',
  'Authenticated user cannot elevate role to admin'
);

-- 7. Test Authenticated user cannot change their account_status
select throws_ok(
  'update public.users set account_status = ''suspended'' where id = ''11111111-1111-1111-1111-111111111111''',
  'new row violates row-level security policy for table "users"',
  'Authenticated user cannot change account status'
);

-- 8. Test Authenticated user cannot change their ID
select throws_ok(
  'update public.users set id = ''22222222-2222-2222-2222-222222222222'' where id = ''11111111-1111-1111-1111-111111111111''',
  'new row violates row-level security policy for table "users"',
  'Authenticated user cannot hijack another ID'
);

-- 9. Check that the update to the other user failed
reset role;
select results_eq(
  'select full_name from public.users where id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY['Other User'::varchar],
  'Other user was not updated by the hacker'
);

select * from finish();
rollback;
