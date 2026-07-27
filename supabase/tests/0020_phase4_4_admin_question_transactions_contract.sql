begin;

select plan(17);

-- 1. Test Setup
-- Create mock users in auth.users
insert into auth.users (id, email) values 
  ('00200000-0000-0000-0000-000000000001', 'p44-active-admin@example.test'),
  ('00200000-0000-0000-0000-000000000002', 'p44-student@example.test'),
  ('00200000-0000-0000-0000-000000000003', 'p44-suspended-admin@example.test'),
  ('00200000-0000-0000-0000-000000000004', 'p44-deleted-admin@example.test');

-- Update matching profiles created by the auth trigger in public.users
update public.users set role = 'admin' where id = '00200000-0000-0000-0000-000000000001';
update public.users set role = 'student' where id = '00200000-0000-0000-0000-000000000002';
update public.users set role = 'admin', account_status = 'suspended' where id = '00200000-0000-0000-0000-000000000003';
update public.users set role = 'admin', deleted_at = now() where id = '00200000-0000-0000-0000-000000000004';

-- Create active taxonomies
insert into public.question_categories (id, slug, name) values ('11111111-1111-1111-1111-111111111111', 'cat-active', 'Category');
insert into public.question_difficulties (id, slug, name) values ('22222222-2222-2222-2222-222222222222', 'diff-active', 'Difficulty');
insert into public.question_interview_types (id, slug, name) values ('33333333-3333-3333-3333-333333333333', 'type-active', 'Type');
insert into public.question_skills (id, slug, name) values ('44444444-4444-4444-4444-444444444444', 'skill-active', 'Skill');
insert into public.question_topics (id, slug, name) values ('55555555-5555-5555-5555-555555555555', 'topic-active', 'Topic');

-- Setup testing impersonation function
create or replace function public.impersonate(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', uid), true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function public.clear_impersonation() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  perform set_config('role', 'postgres', true);
end;
$$;

-- Authenticate as admin
select public.impersonate('00200000-0000-0000-0000-000000000001');

-- 2. Test successful creation
select lives_ok(
  $$
    select public.admin_create_question(
      'Valid Question Text',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      'Ref answer',
      '{"guidance": "Eval guidance"}'::jsonb,
      array['44444444-4444-4444-4444-444444444444']::uuid[],
      array['55555555-5555-5555-5555-555555555555']::uuid[]
    )
  $$,
  'Admin can successfully create a question with mappings and internal data'
);

-- Store ID for update tests
create temp table temp_q on commit drop as select id from public.questions where question_text = 'Valid Question Text';

-- 3. Test rollback on invalid internal data (exceeds max length, violating check constraint)
select throws_like(
  $$
    select public.admin_create_question(
      'Will Rollback',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      repeat('a', 5001), -- Check constraint length <= 5000
      null
    )
  $$,
  '%violates check constraint "question_internal_data_reference_answer_check"%',
  'Rolls back on internal data constraint failure'
);
select is_empty(
  $$ select 1 from public.questions where question_text = 'Will Rollback' $$,
  'Proves nothing was partially inserted'
);

-- 4. Test rollback on invalid skill reference (FK violation)
select throws_like(
  $$
    select public.admin_create_question(
      'Invalid Skill',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      array['99999999-9999-9999-9999-999999999999']::uuid[]
    )
  $$,
  '%violates foreign key constraint%',
  'Rolls back on invalid skill FK'
);

-- 5. Test duplicate mappings
select throws_like(
  $$
    select public.admin_create_question(
      'Duplicate Skills',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333',
      null,
      null,
      array['44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444']::uuid[]
    )
  $$,
  '%violates unique constraint%',
  'Rolls back on duplicate skill mapping inserts'
);

-- 6. Test mapping semantics and successful atomic update
-- Initially, we have skill 44444444 and topic 55555555.
-- Test a: Omitted array -> preserves existing topic mapping
-- Test b: Empty array -> clears existing skill mapping
select lives_ok(
  $$
    select public.admin_update_question(
      (select id from temp_q),
      '{"question_text": "Updated Atomic", "skill_ids": []}'::jsonb
    )
  $$,
  'Successfully performs an atomic partial update (omitted properties preserved, empty clears)'
);

select is_empty(
  $$ select 1 from public.question_skill_mappings where question_id = (select id from temp_q) $$,
  'Empty array cleared skill mappings'
);

select results_eq(
  $$ select topic_id from public.question_topic_mappings where question_id = (select id from temp_q) $$,
  $$ values ('55555555-5555-5555-5555-555555555555'::uuid) $$,
  'Omitted array preserved topic mappings'
);

-- Test c: Duplicate IDs -> rejected
select throws_like(
  $$
    select public.admin_update_question(
      (select id from temp_q),
      '{"topic_ids": ["55555555-5555-5555-5555-555555555555", "55555555-5555-5555-5555-555555555555"]}'::jsonb
    )
  $$,
  '%violates unique constraint%',
  'Duplicate topic mappings are rejected'
);

-- 7. Test rollback on update with invalid topic reference
select throws_like(
  $$
    select public.admin_update_question(
      (select id from temp_q),
      '{"question_text": "Should not survive", "topic_ids": ["99999999-9999-9999-9999-999999999999"]}'::jsonb
    )
  $$,
  '%violates foreign key constraint%',
  'Rolls back partial update when mapping fails'
);

-- 8. Test lifecycle rejection
select throws_like(
  $$
    select public.admin_update_question(
      (select id from temp_q),
      '{"status": "published"}'::jsonb
    )
  $$,
  '%Cannot update lifecycle fields via this RPC%',
  'Rejects lifecycle fields in update payload'
);

select is_empty(
  $$ select 1 from public.question_skill_mappings where question_id = (select id from temp_q) $$,
  'Proves skill mappings deletion from previous atomic update survived, and current rollback did not revert previous state'
);

-- 8. Test authorization (Student)
select public.impersonate('00200000-0000-0000-0000-000000000002');
select throws_like(
  $$
    select public.admin_create_question(
      'Student Try',
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    )
  $$,
  '%Unauthorized%',
  'Student caller cannot execute RPC'
);

select throws_like(
  $$
    select public.admin_update_question(
      (select id from temp_q),
      '{"question_text": "Student Hack"}'::jsonb
    )
  $$,
  '%Unauthorized%',
  'Student caller cannot execute update RPC'
);

-- 9. Test authorization (Suspended Admin)
select public.impersonate('00200000-0000-0000-0000-000000000003');
select throws_like(
  $$ select public.admin_create_question('Test', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '%Unauthorized%',
  'Suspended admin caller cannot execute RPC'
);

-- 10. Test authorization (Deleted Admin)
select public.impersonate('00200000-0000-0000-0000-000000000004');
select throws_like(
  $$ select public.admin_create_question('Test', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '%Unauthorized%',
  'Deleted admin caller cannot execute RPC'
);

-- 11. Test authorization (Anonymous)
select set_config('role', 'anon', true);
select throws_like(
  $$ select public.admin_create_question('Test', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333') $$,
  '%permission denied for function admin_create_question%',
  'Anonymous user cannot execute RPC'
);

select * from finish();
rollback;
