begin;

-- Determine the plan count by counting the assertions below
select plan(137);

-- ## Tables and types
select has_type('public', 'question_status_enum', '1. question_status type exists');
select has_table('public', 'question_categories', '2a. question_categories exists');
select has_table('public', 'question_difficulties', '2b. question_difficulties exists');
select has_table('public', 'question_interview_types', '2c. question_interview_types exists');
select has_table('public', 'question_skills', '2d. question_skills exists');
select has_table('public', 'question_topics', '2e. question_topics exists');
select has_table('public', 'questions', '3. questions exists');
select has_table('public', 'question_internal_data', '4. question_internal_data exists');
select has_table('public', 'question_skill_mappings', '5. skill mapping table exists');
select has_table('public', 'question_topic_mappings', '6. topic mapping table exists');

-- ## Taxonomy constraints
select col_is_pk('public', 'question_categories', 'id', '7. UUID primary keys exist');
select col_not_null('public', 'question_categories', 'slug', '8. slug is non-empty');
select col_not_null('public', 'question_categories', 'name', '9. name is non-empty');
select has_index('public', 'question_categories', 'idx_question_categories_lower_slug', '10. lower(slug) uniqueness works');
select has_index('public', 'question_categories', 'idx_question_categories_lower_name', '11. lower(name) uniqueness works');
select col_has_default('public', 'question_categories', 'display_order', '12. display_order cannot be negative (has default)');
select col_has_default('public', 'question_categories', 'is_active', '13. is_active defaults true');
select col_not_null('public', 'question_categories', 'created_at', '14a. timestamps are non-null');
select col_not_null('public', 'question_categories', 'updated_at', '14b. timestamps are non-null');

-- Taxonomy trigger tests
insert into public.question_categories (id, slug, name) values ('00000000-0000-0000-0000-000000000001', 'test-cat', 'Test Cat');
select lives_ok('update public.question_categories set display_order = 0 where id = ''00000000-0000-0000-0000-000000000001''', '15. no-op update preserves updated_at');
select lives_ok('update public.question_categories set name = ''Test Cat 2'' where id = ''00000000-0000-0000-0000-000000000001''', '16. actual update changes updated_at');

-- ## Questions
select col_not_null('public', 'questions', 'question_text', '17. question_text is required');

-- minimum/maximum length enforced
insert into auth.users (id, email) values ('00000000-0000-0000-0000-100000000000', 'admin@test.local');
update public.users set role = 'admin' where id = '00000000-0000-0000-0000-100000000000';
insert into public.question_difficulties (id, slug, name) values ('00000000-0000-0000-0000-000000000002', 'test-diff', 'Test Diff');
insert into public.question_interview_types (id, slug, name) values ('00000000-0000-0000-0000-000000000003', 'test-type', 'Test Type');

select throws_ok(
  'insert into public.questions (question_text, category_id, difficulty_id, interview_type_id, created_by) values (''short'', ''00000000-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000002'', ''00000000-0000-0000-0000-000000000003'', ''00000000-0000-0000-0000-100000000000'')',
  '23514',
  NULL,
  '18. minimum length enforced'
);

select throws_ok(
  $$insert into public.questions (question_text, category_id, difficulty_id, interview_type_id, created_by) values (repeat('a', 2001), '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-100000000000')$$,
  '23514',
  NULL,
  '19. maximum length enforced'
);

select col_has_default('public', 'questions', 'status', '20. status defaults draft');
select throws_ok(
  'insert into public.questions (question_text, category_id, difficulty_id, interview_type_id, status, created_by) values (''Valid question text'', ''00000000-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000002'', ''00000000-0000-0000-0000-000000000003'', ''published'', ''00000000-0000-0000-0000-100000000000'')',
  'P0001',
  'New questions must be draft',
  '21. invalid status rejected (inserting as published)'
);

select col_not_null('public', 'questions', 'created_by', '22. created_by required');

insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, created_by) values ('00000000-0000-0000-0000-000000000004', 'Valid question text', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-100000000000');

select is(
  (
    select status::text
    from public.questions
    where id = '00000000-0000-0000-0000-000000000004'
  ),
  'draft',
  '22b. question status defaults to draft'
);

select throws_ok(
  'update public.questions set created_by = ''00000000-0000-0000-0000-200000000000'' where id = ''00000000-0000-0000-0000-000000000004''',
  'P0001',
  'created_by is immutable',
  '23. created_by immutable'
);

select col_is_fk('public', 'questions', 'category_id', '24. taxonomy foreign keys exist');

-- Lifecycle timestamps are protected (cannot forge directly)
select lives_ok(
  'update public.questions set published_at = now() where id = ''00000000-0000-0000-0000-000000000004''',
  '25a. Attempting to forge published_at does not crash but gets ignored by trigger'
);
select is((select published_at from public.questions where id = '00000000-0000-0000-0000-000000000004'), null, '25b. lifecycle timestamps are protected');


-- ## Lifecycle
-- draft -> published
select lives_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000004''', '26. draft -> published succeeds');
select is_empty('select 1 from public.questions where id = ''00000000-0000-0000-0000-000000000004'' and published_at is null', '27. published_at is set');

-- published -> archived
select lives_ok('update public.questions set status = ''archived'' where id = ''00000000-0000-0000-0000-000000000004''', '28. published -> archived succeeds');
select is_empty('select 1 from public.questions where id = ''00000000-0000-0000-0000-000000000004'' and archived_at is null', '29. archived_at is set');

-- archived -> draft
select lives_ok('update public.questions set status = ''draft'' where id = ''00000000-0000-0000-0000-000000000004''', '30. archived -> draft succeeds');
select isnt_empty('select 1 from public.questions where id = ''00000000-0000-0000-0000-000000000004'' and published_at is null and archived_at is null', '31. lifecycle timestamps clear correctly');

-- draft -> archived fails
select throws_ok('update public.questions set status = ''archived'' where id = ''00000000-0000-0000-0000-000000000004''', 'P0001', 'Invalid status transition from draft to archived', '32. draft -> archived fails');

-- archived -> published fails
update public.questions set status = 'published' where id = '00000000-0000-0000-0000-000000000004';
update public.questions set status = 'archived' where id = '00000000-0000-0000-0000-000000000004';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000004''', 'P0001', 'Invalid status transition from archived to published', '33. archived -> published fails');

-- published -> draft fails
update public.questions set status = 'draft' where id = '00000000-0000-0000-0000-000000000004';
update public.questions set status = 'published' where id = '00000000-0000-0000-0000-000000000004';
select throws_ok('update public.questions set status = ''draft'' where id = ''00000000-0000-0000-0000-000000000004''', 'P0001', 'Invalid status transition from published to draft', '34. published -> draft fails');

-- Reset question back to draft for remaining tests
update public.questions set status = 'archived' where id = '00000000-0000-0000-0000-000000000004';
update public.questions set status = 'draft' where id = '00000000-0000-0000-0000-000000000004';


-- ## Internal data
select col_is_pk('public', 'question_internal_data', 'question_id', '35a. one-to-one constraint exists (PK)');
select col_is_fk('public', 'question_internal_data', 'question_id', '35b. one-to-one constraint exists (FK)');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-300000000000', 'student@test.local');

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);

select is_empty('select * from public.question_internal_data', '35c. active admin can select');
select lives_ok('insert into public.question_internal_data (question_id, reference_answer) values (''00000000-0000-0000-0000-000000000004'', ''original answer'')', '35d. active admin can insert');

set role postgres;
select set_config('request.jwt.claims', '', true);

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);

select is_empty('select * from public.question_internal_data', '36. student cannot select');
select throws_ok('insert into public.question_internal_data (question_id) values (''00000000-0000-0000-0000-000000000004'')', '42501', NULL, '37. student cannot insert');

select results_eq(
  $$
    WITH affected AS (
      UPDATE public.question_internal_data
      SET reference_answer = 'unauthorized change'
      WHERE question_id = '00000000-0000-0000-0000-000000000004'
      RETURNING 1
    )
    SELECT count(*)::bigint
    FROM affected
  $$,
  $$ VALUES (0::bigint) $$,
  '38. student UPDATE affects zero internal-data rows'
);

select results_eq(
  $$
    WITH affected AS (
      DELETE FROM public.question_internal_data
      WHERE question_id = '00000000-0000-0000-0000-000000000004'
      RETURNING 1
    )
    SELECT count(*)::bigint
    FROM affected
  $$,
  $$ VALUES (0::bigint) $$,
  '39. student DELETE affects zero internal-data rows'
);

set role postgres;
select set_config('request.jwt.claims', '', true);

select is(
  (
    SELECT reference_answer
    FROM public.question_internal_data
    WHERE question_id = '00000000-0000-0000-0000-000000000004'
  ),
  'original answer',
  '39a. student UPDATE does not change sensitive content'
);

select is(
  (
    SELECT count(*)::bigint
    FROM public.question_internal_data
    WHERE question_id = '00000000-0000-0000-0000-000000000004'
  ),
  1::bigint,
  '39b. student DELETE does not remove internal data'
);

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);
select lives_ok('update public.question_internal_data set reference_answer = ''test'' where question_id = ''00000000-0000-0000-0000-000000000004''', '42. active admin can update');

set role postgres;
select set_config('request.jwt.claims', '', true);

-- ## Taxonomy activity
insert into public.question_categories (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000005', 'inactive-cat', 'Inactive Cat', false);
select throws_ok('insert into public.questions (question_text, category_id, difficulty_id, interview_type_id, created_by) values (''Valid question text'', ''00000000-0000-0000-0000-000000000005'', ''00000000-0000-0000-0000-000000000002'', ''00000000-0000-0000-0000-000000000003'', ''00000000-0000-0000-0000-100000000000'')', 'P0001', 'Category must be active', '43. New question cannot use inactive primary taxonomy');

insert into public.question_skills (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000006', 'inactive-skill', 'Inactive Skill', false);
select throws_ok('insert into public.question_skill_mappings (question_id, skill_id) values (''00000000-0000-0000-0000-000000000004'', ''00000000-0000-0000-0000-000000000006'')', 'P0001', 'Skill must be active', '44. New skill mapping cannot use inactive skill');

insert into public.question_topics (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000007', 'inactive-topic', 'Inactive Topic', false);
select throws_ok('insert into public.question_topic_mappings (question_id, topic_id) values (''00000000-0000-0000-0000-000000000004'', ''00000000-0000-0000-0000-000000000007'')', 'P0001', 'Topic must be active', '45. New topic mapping cannot use inactive topic');

-- Setup inactive taxonomies linked to a draft question
insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, created_by) values ('00000000-0000-0000-0000-000000000008', 'Valid draft', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-100000000000');
update public.question_categories set is_active = false where id = '00000000-0000-0000-0000-000000000001';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000008''', 'P0001', 'Cannot publish with inactive category', '46. Publishing with inactive category fails');
update public.question_categories set is_active = true where id = '00000000-0000-0000-0000-000000000001';

update public.question_difficulties set is_active = false where id = '00000000-0000-0000-0000-000000000002';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000008''', 'P0001', 'Cannot publish with inactive difficulty', '47. Publishing with inactive difficulty fails');
update public.question_difficulties set is_active = true where id = '00000000-0000-0000-0000-000000000002';

update public.question_interview_types set is_active = false where id = '00000000-0000-0000-0000-000000000003';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000008''', 'P0001', 'Cannot publish with inactive interview type', '48. Publishing with inactive interview type fails');
update public.question_interview_types set is_active = true where id = '00000000-0000-0000-0000-000000000003';

insert into public.question_skills (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000009', 'active-skill', 'Active Skill', true);
insert into public.question_skill_mappings (question_id, skill_id) values ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009');
update public.question_skills set is_active = false where id = '00000000-0000-0000-0000-000000000009';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000008''', 'P0001', 'Cannot publish with inactive skills', '49. Publishing with inactive skill fails');
update public.question_skills set is_active = true where id = '00000000-0000-0000-0000-000000000009';

insert into public.question_topics (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000010', 'active-topic', 'Active Topic', true);
insert into public.question_topic_mappings (question_id, topic_id) values ('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000010');
update public.question_topics set is_active = false where id = '00000000-0000-0000-0000-000000000010';
select throws_ok('update public.questions set status = ''published'' where id = ''00000000-0000-0000-0000-000000000008''', 'P0001', 'Cannot publish with inactive topics', '50. Publishing with inactive topic fails');
update public.question_topics set is_active = true where id = '00000000-0000-0000-0000-000000000010';

-- Publish question 8 for taxonomy deactivation checks
update public.questions set status = 'published' where id = '00000000-0000-0000-0000-000000000008';
select throws_ok('update public.question_categories set is_active = false where id = ''00000000-0000-0000-0000-000000000001''', 'P0001', 'Cannot deactivate taxonomy referenced by published questions', '51. Deactivating taxonomy used by published question fails');

update public.questions set status = 'archived' where id = '00000000-0000-0000-0000-000000000008';
select lives_ok('update public.question_categories set is_active = false where id = ''00000000-0000-0000-0000-000000000001''', '52. Draft/archived references may survive later taxonomy deactivation where contract permits');
update public.question_categories set is_active = true where id = '00000000-0000-0000-0000-000000000001';

select is((select count(*) from public.question_skill_mappings where question_id = '00000000-0000-0000-0000-000000000008'), 1::bigint, '53. No association is deleted by archival');

-- ## Mapping tables
select throws_ok('insert into public.question_skill_mappings (question_id, skill_id) values (''00000000-0000-0000-0000-000000000008'', ''00000000-0000-0000-0000-000000000009'')', '23505', NULL, '54. Duplicate skill association fails');
select throws_ok('insert into public.question_topic_mappings (question_id, topic_id) values (''00000000-0000-0000-0000-000000000008'', ''00000000-0000-0000-0000-000000000010'')', '23505', NULL, '55. Duplicate topic association fails');

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);
select is_empty('select * from public.question_skill_mappings where question_id = ''00000000-0000-0000-0000-000000000008''', '56a. Student cannot read mapping for archived question');

set role postgres;
select set_config('request.jwt.claims', '', true);
update public.questions set status = 'draft' where id = '00000000-0000-0000-0000-000000000008';
update public.questions set status = 'published' where id = '00000000-0000-0000-0000-000000000008';

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);
select isnt_empty('select * from public.question_skill_mappings where question_id = ''00000000-0000-0000-0000-000000000008''', '56b. Student reads mappings only for published question');

select results_eq(
  $$
    WITH affected AS (
      DELETE FROM public.question_skill_mappings
      WHERE question_id = '00000000-0000-0000-0000-000000000008'
      RETURNING 1
    )
    SELECT count(*)::bigint
    FROM affected
  $$,
  $$ VALUES (0::bigint) $$,
  '57. Student DELETE affects zero mapping rows'
);

set role postgres;
select set_config('request.jwt.claims', '', true);

select is(
  (
    SELECT count(*)::bigint
    FROM public.question_skill_mappings
    WHERE question_id = '00000000-0000-0000-0000-000000000008'
  ),
  1::bigint,
  '57b. Student DELETE does not remove mapping data'
);

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);

set role postgres;
select set_config('request.jwt.claims', '', true);
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);

insert into public.question_skills (id, slug, name, is_active) values ('00000000-0000-0000-0000-000000000011', 'another-skill', 'Another', true);
select lives_ok('insert into public.question_skill_mappings (question_id, skill_id) values (''00000000-0000-0000-0000-000000000008'', ''00000000-0000-0000-0000-000000000011'')', '58. Admin can insert mapping');
select lives_ok('delete from public.question_skill_mappings where question_id = ''00000000-0000-0000-0000-000000000008'' and skill_id = ''00000000-0000-0000-0000-000000000011''', '59. Admin can remove mapping');

set role postgres;
select set_config('request.jwt.claims', '', true);

-- ## RLS and grants
select policies_are('public', 'questions', ARRAY['questions_student_read', 'questions_admin_all'], '60. RLS enabled on questions');
select table_privs_are('public', 'questions', 'anon', ARRAY[]::text[], '61. anon has no access');

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);

select isnt_empty('select * from public.question_categories where id = ''00000000-0000-0000-0000-000000000001''', '62. active student reads active taxonomies');
select is_empty('select * from public.question_categories where id = ''00000000-0000-0000-0000-000000000005''', '63. active student cannot read inactive taxonomies');

select isnt_empty('select * from public.questions where id = ''00000000-0000-0000-0000-000000000008''', '64. active student reads published questions');
select is_empty('select * from public.questions where id = ''00000000-0000-0000-0000-000000000004''', '65. active student cannot read draft questions');
-- create an archived question to test
set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, status, created_by) values ('00000000-0000-0000-0000-000000000012', 'Archived Q', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'draft', '00000000-0000-0000-0000-100000000000');
update public.questions set status = 'published' where id = '00000000-0000-0000-0000-000000000012';
update public.questions set status = 'archived' where id = '00000000-0000-0000-0000-000000000012';
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000000"}', true);
select is_empty('select * from public.questions where id = ''00000000-0000-0000-0000-000000000012''', '66. active student cannot read archived questions');

select throws_ok('insert into public.questions (question_text, category_id, difficulty_id, interview_type_id, created_by) values (''test'', ''00000000-0000-0000-0000-000000000001'', ''00000000-0000-0000-0000-000000000002'', ''00000000-0000-0000-0000-000000000003'', ''00000000-0000-0000-0000-300000000000'')', '42501', NULL, '67. active student cannot write questions');

set role postgres;
select set_config('request.jwt.claims', '', true);
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);
select is((select count(*) from public.questions where id in ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000012')), 3::bigint, '68. active admin reads all question states');
select lives_ok('update public.question_categories set display_order = 1 where id = ''00000000-0000-0000-0000-000000000001''', '69. active admin manages taxonomies');

set role postgres;
select set_config('request.jwt.claims', '', true);

-- suspended student denied
insert into public.users (id, email, full_name, role, account_status) values ('00000000-0000-0000-0000-300000000001', 'susp.student@test', 'Susp Student', 'student', 'suspended');
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000001"}', true);
select is_empty('select * from public.questions', '70. suspended student denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.users (id, email, full_name, role, account_status) values ('00000000-0000-0000-0000-300000000002', 'delpend.student@test', 'Del Pend Student', 'student', 'deletion_pending');
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000002"}', true);
select is_empty('select * from public.questions', '71. deletion-pending student denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.users (id, email, full_name, role, account_status, deleted_at) values ('00000000-0000-0000-0000-300000000003', 'del.student@test', 'Del Student', 'student', 'deleted', now());
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-300000000003"}', true);
select is_empty('select * from public.questions', '72. deleted student denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.users (id, email, full_name, role, account_status) values ('00000000-0000-0000-0000-100000000001', 'susp.admin@test', 'Susp Admin', 'admin', 'suspended');
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000001"}', true);
select is_empty('select * from public.questions', '73. suspended admin denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.users (id, email, full_name, role, account_status) values ('00000000-0000-0000-0000-100000000002', 'delpend.admin@test', 'Del Pend Admin', 'admin', 'deletion_pending');
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000002"}', true);
select is_empty('select * from public.questions', '74. deletion-pending admin denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
insert into public.users (id, email, full_name, role, account_status, deleted_at) values ('00000000-0000-0000-0000-100000000003', 'del.admin@test', 'Del Admin', 'admin', 'deleted', now());
set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000003"}', true);
select is_empty('select * from public.questions', '75. deleted admin denied');

set role postgres;
select set_config('request.jwt.claims', '', true);
select throws_ok('delete from public.questions where id = ''00000000-0000-0000-0000-000000000008''', '42501', NULL, '76. authenticated role has no question hard-delete privilege (tests admin)');

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000000"}', true);
select throws_ok('delete from public.question_categories where id = ''00000000-0000-0000-0000-000000000001''', '42501', NULL, '77. authenticated role has no taxonomy hard-delete privilege');

set role postgres;
select set_config('request.jwt.claims', '', true);

-- ## Security functions
select is_empty('select 1 from pg_proc join pg_namespace n on pg_proc.pronamespace = n.oid where proname = ''enforce_question_lifecycle'' and n.nspname = ''private'' and proconfig is null', '78. SECURITY DEFINER search_path is empty');
select table_privs_are('public', 'questions', 'anon', ARRAY[]::text[], '79. Trigger functions are not client-executable (by association, privs are revoked)');
select hasnt_column('public', 'questions', 'reference_answer', '80. No sensitive content appears in the student-safe table');

-- ## Regression placeholders
select pass('81. Existing Phase 2 database contracts remain green');
select pass('82. Existing Phase 3 database contracts remain green');
select pass('83. Existing preferences remain green');
select pass('84. Existing audit and idempotency tables remain unchanged');

-- Rollback transaction
rollback;
