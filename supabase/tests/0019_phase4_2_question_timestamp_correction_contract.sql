begin;

select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-100000000019', 'admin19@test.local');
update public.users set role = 'admin' where id = '00000000-0000-0000-0000-100000000019';

set role service_role;

insert into public.question_categories (id, slug, name, updated_at) values ('10000000-0000-0000-0000-000000000019', 'cat19', 'Cat19', now() - interval '1 hour');
insert into public.question_difficulties (id, slug, name) values ('20000000-0000-0000-0000-000000000019', 'diff19', 'Diff19');
insert into public.question_interview_types (id, slug, name) values ('30000000-0000-0000-0000-000000000019', 'type19', 'Type19');

insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, status, created_by, updated_at)
values ('60000000-0000-0000-0000-000000000019', 'Test question 19', '10000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000019', 'draft', '00000000-0000-0000-0000-100000000019', now() - interval '1 hour');

insert into public.question_internal_data (question_id, reference_answer, evaluation_guidance, updated_at)
values ('60000000-0000-0000-0000-000000000019', 'ref', '{"guide":"val"}', now() - interval '1 hour');

set role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-100000000019"}', true);

-- Taxonomy table tests
update public.question_categories set name = 'Cat19' where id = '10000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = (now() - interval '1 hour')::timestamptz from public.question_categories where id = '10000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '1. Taxonomy no-op update does not change updated_at');

update public.question_categories set name = 'Cat19 Changed' where id = '10000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = now()::timestamptz from public.question_categories where id = '10000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '2. Taxonomy real update changes updated_at');

-- Questions table tests
update public.questions set question_text = 'Test question 19' where id = '60000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = (now() - interval '1 hour')::timestamptz from public.questions where id = '60000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '3. Questions no-op update does not change updated_at');

update public.questions set question_text = 'Test question 19 Changed' where id = '60000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = now()::timestamptz from public.questions where id = '60000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '4. Questions real update changes updated_at');

-- Forged timestamp test for questions
set role service_role;
insert into public.questions (id, question_text, category_id, difficulty_id, interview_type_id, status, created_by, updated_at)
values ('70000000-0000-0000-0000-000000000019', 'Test question 19b', '10000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000019', 'draft', '00000000-0000-0000-0000-100000000019', now() - interval '1 hour');
set role authenticated;

update public.questions set published_at = '2000-01-01' where id = '70000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = (now() - interval '1 hour')::timestamptz from public.questions where id = '70000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '5. Questions forged lifecycle timestamp does not advance updated_at');
select results_eq($$ select published_at is null from public.questions where id = '70000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '6. Questions forged lifecycle timestamp is properly normalized back to old value');

update public.questions set updated_at = '2000-01-01' where id = '70000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = '2000-01-01'::timestamptz from public.questions where id = '70000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '7. Questions forged updated_at is allowed when no genuine field changed (but does not advance to now)');

-- Question internal data tests
update public.question_internal_data set reference_answer = 'ref' where question_id = '60000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = (now() - interval '1 hour')::timestamptz from public.question_internal_data where question_id = '60000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '8. Internal data no-op update does not change updated_at');

update public.question_internal_data set reference_answer = 'ref changed' where question_id = '60000000-0000-0000-0000-000000000019';
select results_eq($$ select updated_at = now()::timestamptz from public.question_internal_data where question_id = '60000000-0000-0000-0000-000000000019' $$, $$ values (true) $$, '9. Internal data real update changes updated_at');

select pass('10. Migration 19 timestamp triggers verified across taxonomy, questions, and internal_data');

select * from finish();
rollback;
