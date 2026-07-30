begin;

select plan(64);

-- 1. Setup Data
insert into auth.users (id, email, raw_user_meta_data) values
  ('00220000-0000-0000-0000-000000000001', 'p53-active-student@example.test', '{"fullName":"P5.3 Active Student"}'::jsonb),
  ('00220000-0000-0000-0000-000000000002', 'p53-other-student@example.test', '{"fullName":"P5.3 Other Student"}'::jsonb),
  ('00220000-0000-0000-0000-000000000003', 'p53-suspended-student@example.test', '{"fullName":"P5.3 Suspended Student"}'::jsonb),
  ('00220000-0000-0000-0000-000000000004', 'p53-deleted-student@example.test', '{"fullName":"P5.3 Deleted Student"}'::jsonb),
  ('00220000-0000-0000-0000-000000000005', 'p53-no-profile-student@example.test', '{"fullName":"P5.3 No Profile Student"}'::jsonb);

update public.users set role = 'student', account_status = 'active' where id = '00220000-0000-0000-0000-000000000001';
update public.users set role = 'student', account_status = 'active' where id = '00220000-0000-0000-0000-000000000002';
update public.users set role = 'student', account_status = 'suspended' where id = '00220000-0000-0000-0000-000000000003';
update public.users set role = 'student', account_status = 'deleted', deleted_at = clock_timestamp() where id = '00220000-0000-0000-0000-000000000004';
delete from public.users where id = '00220000-0000-0000-0000-000000000005';

insert into public.question_difficulties (id, slug, name, is_active) values
  ('22222222-2222-2222-2222-222222222222', 'diff-act', 'Diff Act', true),
  ('22222222-2222-2222-2222-222222222223', 'diff-inact', 'Diff Inact', false);

insert into public.question_interview_types (id, slug, name, is_active) values
  ('33333333-3333-3333-3333-333333333333', 'type-act', 'Type Act', true),
  ('33333333-3333-3333-3333-333333333334', 'type-inact', 'Type Inact', false);

insert into public.question_skills (id, slug, name, is_active) values
  ('44444444-4444-4444-4444-444444444401', 'skill-1', 'Skill 1', true),
  ('44444444-4444-4444-4444-444444444402', 'skill-2', 'Skill 2', true),
  ('44444444-4444-4444-4444-444444444403', 'skill-3', 'Skill 3', true),
  ('44444444-4444-4444-4444-444444444404', 'skill-4', 'Skill 4', true),
  ('44444444-4444-4444-4444-444444444405', 'skill-5', 'Skill 5', true),
  ('44444444-4444-4444-4444-444444444406', 'skill-6', 'Skill 6', true),
  ('44444444-4444-4444-4444-444444444407', 'skill-7', 'Skill 7', true),
  ('44444444-4444-4444-4444-444444444408', 'skill-8', 'Skill 8', true),
  ('44444444-4444-4444-4444-444444444409', 'skill-9', 'Skill 9', true),
  ('44444444-4444-4444-4444-444444444410', 'skill-10', 'Skill 10', true),
  ('44444444-4444-4444-4444-444444444411', 'skill-11', 'Skill 11', true),
  ('44444444-4444-4444-4444-444444444499', 'skill-inact', 'Skill Inactive', false);

insert into public.question_topics (id, slug, name, is_active) values
  ('55555555-5555-5555-5555-555555555501', 'topic-1', 'Topic 1', true),
  ('55555555-5555-5555-5555-555555555502', 'topic-2', 'Topic 2', true),
  ('55555555-5555-5555-5555-555555555503', 'topic-3', 'Topic 3', true),
  ('55555555-5555-5555-5555-555555555504', 'topic-4', 'Topic 4', true),
  ('55555555-5555-5555-5555-555555555505', 'topic-5', 'Topic 5', true),
  ('55555555-5555-5555-5555-555555555506', 'topic-6', 'Topic 6', true),
  ('55555555-5555-5555-5555-555555555507', 'topic-7', 'Topic 7', true),
  ('55555555-5555-5555-5555-555555555508', 'topic-8', 'Topic 8', true),
  ('55555555-5555-5555-5555-555555555509', 'topic-9', 'Topic 9', true),
  ('55555555-5555-5555-5555-555555555510', 'topic-10', 'Topic 10', true),
  ('55555555-5555-5555-5555-555555555511', 'topic-11', 'Topic 11', true),
  ('55555555-5555-5555-5555-555555555598', 'topic-98', 'Topic 98', true),
  ('55555555-5555-5555-5555-555555555599', 'topic-inact', 'Topic Inactive', false);

create or replace function public.impersonate(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', format('{"sub": "%s", "role": "authenticated"}', uid), true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function public.tmp_fail_topic_mapping() returns trigger language plpgsql as $$
begin
  if new.topic_id = '55555555-5555-5555-5555-555555555598' then
     raise exception 'INJECTED_DB_ERROR' using errcode = 'P9999';
  end if;
  return new;
end;
$$;

create trigger tmp_trg_fail_topic before insert on public.interview_topic_mappings
for each row execute function public.tmp_fail_topic_mapping();

-- 1. Signature
select has_function('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'create exists');
select is_definer('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'create is SECURITY DEFINER');
select function_returns('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'uuid', 'create returns uuid');

select has_function(
  'public',
  'student_update_interview_config',
  array['uuid', 'timestamp with time zone', 'jsonb'],
  'update exists'
);
select is_definer(
  'public',
  'student_update_interview_config',
  array['uuid', 'timestamp with time zone', 'jsonb'],
  'update is SECURITY DEFINER'
);
select function_returns(
  'public',
  'student_update_interview_config',
  array['uuid', 'timestamp with time zone', 'jsonb'],
  'uuid',
  'update returns uuid'
);

-- 2. Hardened Search Path
SELECT ok(
  COALESCE(
    (
      SELECT 'search_path=""' = ANY (procedure.proconfig)
      FROM pg_proc AS procedure
      WHERE procedure.oid = to_regprocedure(
        'public.student_create_interview_config(text,text,uuid,uuid,integer,integer,uuid[],uuid[])'
      )
    ),
    false
  ),
  'create has hardened search_path'
);
SELECT ok(
  COALESCE(
    (
      SELECT 'search_path=""' = ANY (procedure.proconfig)
      FROM pg_proc AS procedure
      WHERE procedure.oid = to_regprocedure(
        'public.student_update_interview_config(uuid,timestamptz,jsonb)'
      )
    ),
    false
  ),
  'update has hardened search_path'
);

-- 3. Exact Function Privileges
select function_privs_are('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'authenticated', array['EXECUTE'], 'auth create EXECUTE');
SELECT is_empty(
  $$
    SELECT 1
    FROM pg_proc AS procedure
    CROSS JOIN LATERAL aclexplode(
      COALESCE(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )
    ) AS privilege
    WHERE procedure.oid = to_regprocedure(
      'public.student_create_interview_config(text,text,uuid,uuid,integer,integer,uuid[],uuid[])'
    )
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  $$,
  'PUBLIC create none'
);
select function_privs_are('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'anon', array[]::text[], 'anon create none');
select function_privs_are('public', 'student_create_interview_config', array['text', 'text', 'uuid', 'uuid', 'integer', 'integer', 'uuid[]', 'uuid[]'], 'service_role', array[]::text[], 'service_role create none');

select function_privs_are('public', 'student_update_interview_config', array['uuid', 'timestamp with time zone', 'jsonb'], 'authenticated', array['EXECUTE'], 'auth update EXECUTE');
SELECT is_empty(
  $$
    SELECT 1
    FROM pg_proc AS procedure
    CROSS JOIN LATERAL aclexplode(
      COALESCE(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )
    ) AS privilege
    WHERE procedure.oid = to_regprocedure(
      'public.student_update_interview_config(uuid,timestamptz,jsonb)'
    )
      AND privilege.grantee = 0
      AND privilege.privilege_type = 'EXECUTE'
  $$,
  'PUBLIC update none'
);
select function_privs_are('public', 'student_update_interview_config', array['uuid', 'timestamp with time zone', 'jsonb'], 'anon', array[]::text[], 'anon update none');
select function_privs_are('public', 'student_update_interview_config', array['uuid', 'timestamp with time zone', 'jsonb'], 'service_role', array[]::text[], 'service_role update none');

-- 4. Auth & Account States
select set_config('request.jwt.claims', '{}', true);
select set_config('role', 'authenticated', true);
select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0001', 'FORBIDDEN_ACCESS', 'Missing JWT subject'
);

select public.impersonate('00220000-0000-0000-0000-000000000005');
select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0001', 'FORBIDDEN_ACCESS', 'Missing public profile'
);

select public.impersonate('00220000-0000-0000-0000-000000000004');
select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0001', 'FORBIDDEN_ACCESS', 'Deleted account'
);

select public.impersonate('00220000-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0001', 'FORBIDDEN_ACCESS', 'Suspended account'
);

-- 5. Taxonomy Validation
select public.impersonate('00220000-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222223', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Inactive difficulty'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333334', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Inactive type'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444499']::uuid[], array[]::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Inactive skill'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array['55555555-5555-5555-5555-555555555599']::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Inactive topic'
);

-- 6. Duplicate rejections & Max Limits
select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401', '44444444-4444-4444-4444-444444444401']::uuid[], array[]::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Duplicate create skills rejected'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array['55555555-5555-5555-5555-555555555501', '55555555-5555-5555-5555-555555555501']::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Duplicate create topics rejected'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401', '44444444-4444-4444-4444-444444444402', '44444444-4444-4444-4444-444444444403', '44444444-4444-4444-4444-444444444404', '44444444-4444-4444-4444-444444444405', '44444444-4444-4444-4444-444444444406', '44444444-4444-4444-4444-444444444407', '44444444-4444-4444-4444-444444444408', '44444444-4444-4444-4444-444444444409', '44444444-4444-4444-4444-444444444410', '44444444-4444-4444-4444-444444444411']::uuid[], array[]::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Over 10 skills rejected'
);

select throws_ok(
  $$ select public.student_create_interview_config('t', 'r', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30, array['44444444-4444-4444-4444-444444444401']::uuid[], array['55555555-5555-5555-5555-555555555501', '55555555-5555-5555-5555-555555555502', '55555555-5555-5555-5555-555555555503', '55555555-5555-5555-5555-555555555504', '55555555-5555-5555-5555-555555555505', '55555555-5555-5555-5555-555555555506', '55555555-5555-5555-5555-555555555507', '55555555-5555-5555-5555-555555555508', '55555555-5555-5555-5555-555555555509', '55555555-5555-5555-5555-555555555510', '55555555-5555-5555-5555-555555555511']::uuid[]) $$,
  'P0004', 'VALIDATION_ERROR', 'Over 10 topics rejected'
);

-- 7. Text bounds
select throws_ok(
  format('select public.student_create_interview_config(''%s'', ''r'', ''33333333-3333-3333-3333-333333333333'', ''22222222-2222-2222-2222-222222222222'', 5, 30, array[''44444444-4444-4444-4444-444444444401'']::uuid[], array[]::uuid[])', repeat('a', 101)),
  'P0004', 'VALIDATION_ERROR', 'Title over 100 rejected'
);

-- 8. Valid Create & Atomic Create Rollback Check
select throws_ok(
  $$
    select public.student_create_interview_config(
      'Atomic Fail', 'Role', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30,
      array['44444444-4444-4444-4444-444444444401']::uuid[], array['55555555-5555-5555-5555-555555555598']::uuid[]
    )
  $$,
  'P9999', 'INJECTED_DB_ERROR', 'Triggered failure during create topic mapping'
);

select is_empty(
  $$ select 1 from public.interviews where title = 'Atomic Fail' $$,
  'Atomic rollback: Failed create left no phantom interviews'
);

select is_empty(
  $$ select 1 from public.interview_skill_mappings where interview_id in (select id from public.interviews where title = 'Atomic Fail') $$,
  'Atomic rollback: Failed create left no phantom skill mappings'
);

select lives_ok(
  $$
    select public.student_create_interview_config(
      'Valid', 'Role', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 5, 30,
      array['44444444-4444-4444-4444-444444444401']::uuid[], array['55555555-5555-5555-5555-555555555501']::uuid[]
    )
  $$,
  'Successful create config'
);

create temp table tmp_cfg as select * from public.interviews where title = 'Valid';

-- 9. Update Rejections
select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Empty update payload rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, null::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Null update payload rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"questionCount": "five"}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Invalid JSON value type rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"unknownKey": "x"}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Unknown payload key rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": []}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Empty update skillIds rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": ["44444444-4444-4444-4444-444444444401", "44444444-4444-4444-4444-444444444401"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Duplicate update skill IDs rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"topicIds": ["55555555-5555-5555-5555-555555555501", "55555555-5555-5555-5555-555555555501"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Duplicate update topic IDs rejected'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"questionCount": 99999999999999}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Large questionCount throws P0004'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"timeLimitMinutes": 99999999999999}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0004', 'VALIDATION_ERROR', 'Large timeLimitMinutes throws P0004'
);

-- 10. CAS & Resource Not Found
select throws_ok(
  format('select public.student_update_interview_config(''%s'', null::timestamptz, ''{"title": "x"}''::jsonb)', (select id from tmp_cfg)),
  'P0003', 'RESOURCE_CONFLICT', 'Null CAS expected timestamp returns P0003'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"title": "x"}''::jsonb)', (select id from tmp_cfg), (select updated_at - interval '1 second' from tmp_cfg)),
  'P0003', 'RESOURCE_CONFLICT', 'CAS updated_at mismatch returns P0003'
);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"title": "x"}''::jsonb)', '00000000-0000-0000-0000-000000000000', (select updated_at from tmp_cfg)),
  'P0002', 'RESOURCE_NOT_FOUND', 'Missing config returns P0002'
);

select public.impersonate('00220000-0000-0000-0000-000000000002');
select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"title": "x"}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P0002', 'RESOURCE_NOT_FOUND', 'Cross-owner config returns P0002'
);

-- 11. Atomic Rollback Verification
select public.impersonate('00220000-0000-0000-0000-000000000001');

select lives_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": ["44444444-4444-4444-4444-444444444401"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'Setup base skill mapping'
);

update tmp_cfg set updated_at = (select updated_at from public.interviews where id = tmp_cfg.id);

select throws_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": ["44444444-4444-4444-4444-444444444402"], "topicIds": ["55555555-5555-5555-5555-555555555598"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'P9999', 'INJECTED_DB_ERROR', 'Triggered failure during update topic mapping'
);

select results_eq(
  format('select skill_id from public.interview_skill_mappings where interview_id = ''%s''', (select id from tmp_cfg)),
  $$ values ('44444444-4444-4444-4444-444444444401'::uuid) $$,
  'Atomic update rollback: Original skill mappings restored after partial update failure'
);

select results_eq(
  format('select updated_at from public.interviews where id = ''%s''', (select id from tmp_cfg)),
  format('select updated_at from tmp_cfg'),
  'Atomic update rollback: Original interview timestamp restored'
);


-- 12. Valid mapping updates
select lives_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"topicIds": []}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'Valid mapping-only update succeeds'
);

select is_empty(
  format('select 1 from public.interview_topic_mappings where interview_id = ''%s''', (select id from tmp_cfg)),
  'Topics were cleared by empty array'
);

select results_ne(
  format('select updated_at from public.interviews where id = ''%s''', (select id from tmp_cfg)),
  format('select updated_at from tmp_cfg'),
  'Mapping-only update advanced updated_at'
);

update tmp_cfg set updated_at = (select updated_at from public.interviews where id = tmp_cfg.id);

-- 13. Reordered Equivalent Mapping No-op & No-op Timestamp Preservation
select lives_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": ["44444444-4444-4444-4444-444444444401", "44444444-4444-4444-4444-444444444402"], "topicIds": ["55555555-5555-5555-5555-555555555501", "55555555-5555-5555-5555-555555555502"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'Update multiple mappings succeeds'
);
update tmp_cfg set updated_at = (select updated_at from public.interviews where id = tmp_cfg.id);

select lives_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"skillIds": ["44444444-4444-4444-4444-444444444402", "44444444-4444-4444-4444-444444444401"], "topicIds": ["55555555-5555-5555-5555-555555555502", "55555555-5555-5555-5555-555555555501"]}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'Reordered equivalent mapping update succeeds (no-op)'
);

select results_eq(
  format('select updated_at from public.interviews where id = ''%s''', (select id from tmp_cfg)),
  format('select updated_at from tmp_cfg'),
  'Reordered mappings are treated as no-op and preserve timestamp'
);

select lives_ok(
  format('select public.student_update_interview_config(''%s'', ''%s''::timestamptz, ''{"title": "Valid"}''::jsonb)', (select id from tmp_cfg), (select updated_at from tmp_cfg)),
  'No-op field update succeeds'
);

select results_eq(
  format('select updated_at from public.interviews where id = ''%s''', (select id from tmp_cfg)),
  format('select updated_at from tmp_cfg'),
  'No-op field update preserves updated_at'
);

-- 14. Omitted preservation
select results_eq(
  format('select count(*)::int from public.interview_skill_mappings where interview_id = ''%s''', (select id from tmp_cfg)),
  $$ values (2::int) $$,
  'Skill mapping preserved when omitted'
);
select results_eq(
  format('select count(*)::int from public.interview_topic_mappings where interview_id = ''%s''', (select id from tmp_cfg)),
  $$ values (2::int) $$,
  'Topic mapping preserved when omitted'
);

-- 15. No Delete RPC
SELECT is_empty(
  $$
    SELECT 1
    FROM pg_proc AS procedure
    JOIN pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'student_delete_interview_config'
  $$,
  'No student_delete_interview_config overload exists'
);

-- 16. No Mutation Privileges
select is_empty(
  $$ select 1 from information_schema.role_table_grants where table_name = 'interviews' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE') $$,
  'No mutation grants on interviews for authenticated'
);
select is_empty(
  $$ select 1 from information_schema.role_table_grants where table_name = 'interview_skill_mappings' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE') $$,
  'No mutation grants on skill mappings for authenticated'
);
select is_empty(
  $$ select 1 from information_schema.role_table_grants where table_name = 'interview_topic_mappings' and grantee = 'authenticated' and privilege_type in ('INSERT', 'UPDATE', 'DELETE') $$,
  'No mutation grants on topic mappings for authenticated'
);

select * from finish();
rollback;
