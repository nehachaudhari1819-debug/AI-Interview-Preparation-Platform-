begin;

select plan(33);

-- ## 1. View and Base Table Permissions
select has_view('public', 'published_questions', '1. Student view exists');
select view_owner_is('public', 'published_questions', 'postgres', '2. View is owned by superuser');
select table_privs_are('public', 'published_questions', 'authenticated', ARRAY['SELECT'], '3. Authenticated has SELECT on view');
select table_privs_are('public', 'questions', 'authenticated', ARRAY['SELECT', 'INSERT', 'UPDATE'], '4. Authenticated retains privileges on base table (for admin policies)');

-- We must test that students get 0 rows from base table due to RLS, and admin gets all.
insert into auth.users (id, email) values 
  ('00000000-0000-0000-0000-100000000000', 'admin18@test.local'),
  ('00000000-0000-0000-0000-300000000000', 'student18@test.local');
update public.users set role = 'admin' where id = '00000000-0000-0000-0000-100000000000';

-- Set up test data (as service_role to bypass RLS)
set role service_role;
insert into public.question_categories (id, slug, name) values ('10000000-0000-0000-0000-000000000000', 'cat1', 'Cat1');
insert into public.question_difficulties (id, slug, name) values ('20000000-0000-0000-0000-000000000000', 'diff1', 'Diff1');
insert into public.question_interview_types (id, slug, name) values ('30000000-0000-0000-0000-000000000000', 'type1', 'Type1');
insert into public.question_skills (id, slug, name) values ('40000000-0000-0000-0000-000000000000', 'skill1', 'Skill1');
insert into public.question_topics (id, slug, name) values ('50000000-0000-0000-0000-000000000000', 'topic1', 'Topic1');

insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, status, created_by)
values ('60000000-0000-0000-0000-000000000000', 'Published test question text here', '10000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'draft', '00000000-0000-0000-0000-100000000000');
update public.questions set status = 'published' where id = '60000000-0000-0000-0000-000000000000';

insert into public.question_internal_data (question_id, evaluation_guidance)
values ('60000000-0000-0000-0000-000000000000', '{"foo":"bar"}'::jsonb);

-- Test student access
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);
set role authenticated;
select results_eq(
  $$ select count(*)::integer from public.questions $$,
  $$ values (0::integer) $$,
  '5. Student gets 0 rows from base table directly'
);
select results_eq(
  $$ select count(*)::integer from public.published_questions $$,
  $$ values (1::integer) $$,
  '6. Student gets 1 row from published_questions view'
);

-- Test admin access
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);
set role authenticated;
select results_eq(
  $$ select count(*)::integer from public.questions $$,
  $$ values (1::integer) $$,
  '7. Admin gets 1 row from base table directly'
);

-- Reset auth
set role postgres;

-- ## 2. evaluation_guidance Type & Shape
select col_type_is('public', 'question_internal_data', 'evaluation_guidance', 'jsonb', '8. evaluation_guidance is jsonb');
select throws_ok(
  $$ insert into public.question_internal_data (question_id, evaluation_guidance) values ('60000000-0000-0000-0000-000000000000', '[]'::jsonb) $$,
  '23514',
  null,
  '9. evaluation_guidance rejects JSON arrays'
);

-- ## 3. No-Op Update Behavior
set role service_role;
-- Taxonomies
select lives_ok(
  $$ update public.question_categories set slug = 'cat1' where id = '10000000-0000-0000-0000-000000000000' $$,
  '10. Taxonomy no-op succeeds'
);

select lives_ok(
  $$ update public.question_categories set slug = 'cat2' where id = '10000000-0000-0000-0000-000000000000' $$,
  '11. Taxonomy actual mutation succeeds'
);

-- Questions
select lives_ok(
  $$ update public.questions set question_text = 'Published test question text here' where id = '60000000-0000-0000-0000-000000000000' $$,
  '12. Question no-op succeeds'
);

select lives_ok(
  $$ update public.questions set question_text = 'New question text here' where id = '60000000-0000-0000-0000-000000000000' $$,
  '13. Question actual mutation succeeds'
);

-- Internal Data
select lives_ok(
  $$ update public.question_internal_data set evaluation_guidance = '{"foo":"bar"}'::jsonb where question_id = '60000000-0000-0000-0000-000000000000' $$,
  '14. Internal Data no-op succeeds'
);

select lives_ok(
  $$ update public.question_internal_data set evaluation_guidance = '{"foo":"baz"}'::jsonb where question_id = '60000000-0000-0000-0000-000000000000' $$,
  '15. Internal Data actual mutation succeeds'
);

-- ## 4. Canonical Taxonomy constraints
select throws_ok(
  $$ insert into public.question_categories (slug, name) values ('UPPERCASE', 'Name') $$,
  '23514',
  null,
  '16. Category rejects uppercase slug'
);
select throws_ok(
  $$ insert into public.question_categories (slug, name) values ('has spaces', 'Name') $$,
  '23514',
  null,
  '17. Category rejects spaced slug'
);
select throws_ok(
  $$ insert into public.question_categories (slug, name) values ('slug', '') $$,
  '23514',
  null,
  '18. Category rejects empty name'
);
select throws_ok(
  $$ insert into public.question_categories (slug, name) values ('slug2', '   ') $$,
  '23514',
  null,
  '19. Category rejects whitespace-only name'
);

-- Same for difficulties, interview_types, skills, topics (sanity checks)
select throws_ok($$ insert into public.question_difficulties (slug, name) values ('UPPER', 'Name') $$, '23514', null, '20. Difficulty rejects uppercase slug');
select throws_ok($$ insert into public.question_interview_types (slug, name) values ('UPPER', 'Name') $$, '23514', null, '21. Interview type rejects uppercase slug');
select throws_ok($$ insert into public.question_skills (slug, name) values ('UPPER', 'Name') $$, '23514', null, '22. Skill rejects uppercase slug');
select throws_ok($$ insert into public.question_topics (slug, name) values ('UPPER', 'Name') $$, '23514', null, '23. Topic rejects uppercase slug');

-- ## 5. Draft questions reassigned to inactive taxonomies
-- Insert an inactive category
insert into public.question_categories (id, slug, name, is_active) values ('99000000-0000-0000-0000-000000000000', 'inactive-cat', 'Inactive Cat', false);

-- Insert a draft question (must be active taxonomy initially)
insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, status, created_by)
values ('70000000-0000-0000-0000-000000000000', 'Draft test question text here', '10000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000000', 'draft', '00000000-0000-0000-0000-100000000000');

select throws_ok(
  $$ update public.questions set category_id = '99000000-0000-0000-0000-000000000000' where id = '70000000-0000-0000-0000-000000000000' $$,
  'P0001',
  'Category must be active',
  '24. Draft question UPDATE rejects inactive category_id'
);

select lives_ok(
  $$ update public.questions set question_text = 'Changed draft text' where id = '70000000-0000-0000-0000-000000000000' $$,
  '25. Draft question UPDATE allows text change without touching category'
);

-- Try to update to active category (lives ok)
insert into public.question_categories (id, slug, name, is_active) values ('99990000-0000-0000-0000-000000000000', 'active-cat2', 'Active Cat2', true);
select lives_ok(
  $$ update public.questions set category_id = '99990000-0000-0000-0000-000000000000' where id = '70000000-0000-0000-0000-000000000000' $$,
  '26. Draft question UPDATE allows changing to new active category'
);

-- ## 6. Published Questions View Security
select columns_are(
    'public',
    'published_questions',
    ARRAY['id', 'question_text', 'category_id', 'difficulty_id', 'interview_type_id', 'created_at', 'updated_at'],
    '27. Exact approved view columns exposed'
);

-- Anonymous access denial
set role anon;
select throws_ok($$ select * from public.published_questions $$, '42501', null, '28. Anonymous access denied');

-- Suspended user
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-400000000000"}', true);
select results_eq($$ select count(*)::integer from public.published_questions $$, $$ values (0::integer) $$, '29. Suspended user receives 0 rows');

-- Deleted user
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-500000000000"}', true);
select results_eq($$ select count(*)::integer from public.published_questions $$, $$ values (0::integer) $$, '30. Deleted user receives 0 rows');

-- Active student read-only behavior
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);

select throws_ok(
  $$ insert into public.published_questions (id, question_text) values ('00000000-0000-0000-0000-000000000099', 'test') $$,
  '42501',
  null,
  '31. Student cannot insert into published_questions view'
);

select throws_ok(
  $$ update public.published_questions set question_text = 'hack' where id = '60000000-0000-0000-0000-000000000000' $$,
  '42501',
  null,
  '32. Student cannot update published_questions view'
);

select throws_ok(
  $$ delete from public.published_questions where id = '60000000-0000-0000-0000-000000000000' $$,
  '42501',
  null,
  '33. Student cannot delete from published_questions view'
);

select * from finish();
rollback;
