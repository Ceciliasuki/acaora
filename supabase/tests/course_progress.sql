-- Runs in an isolated Postgres database. Fixture auth users/roles are supplied by
-- the runner; the auth.uid() implementation matches the live project definition.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.sync_course_progress('STAT-201',1,array['lesson-1'],'lesson-1','[]'::jsonb);
select public.sync_course_progress('STAT-201',1,array['lesson-2'],'lesson-2','[{"id":"30000000-0000-4000-8000-000000000001","questionId":"STAT-201-q","questionVersion":1,"answer":"0","viewedSolution":false,"createdAt":1}]'::jsonb);
do $$ begin
 if (select cardinality(completed_lesson_ids) from public.course_progress where course_id='STAT-201')<>2 then raise exception 'union failed'; end if;
end $$;
-- Retry is idempotent; reusing an ID with a different answer is rejected atomically.
select public.sync_course_progress('STAT-201',1,array['lesson-2'],'lesson-2','[{"id":"30000000-0000-4000-8000-000000000001","questionId":"STAT-201-q","questionVersion":1,"answer":"0","viewedSolution":false,"createdAt":1}]'::jsonb);
do $$ begin
 if (select count(*) from public.course_attempts)<>1 then raise exception 'duplicate attempt'; end if;
 begin
   perform public.sync_course_progress('STAT-201',1,array['lesson-3'],'lesson-3','[{"id":"30000000-0000-4000-8000-000000000001","questionId":"STAT-201-q","questionVersion":1,"answer":"1","viewedSolution":false,"createdAt":1}]'::jsonb);
   raise exception 'conflicting attempt accepted';
 exception when raise_exception then if sqlerrm<>'COURSE_ATTEMPT_CONFLICT' then raise; end if;
 end;
 if (select cardinality(completed_lesson_ids) from public.course_progress where course_id='STAT-201')<>2 then raise exception 'failed operation was not atomic'; end if;
 begin
   update public.course_progress set user_id='10000000-0000-4000-8000-000000000002';
   raise exception 'owner reassignment accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
-- Account B sees and updates only B's records.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $$ begin
 if exists(select 1 from public.course_progress) or exists(select 1 from public.course_attempts) then raise exception 'cross account read'; end if;
 update public.course_progress set last_lesson_id='foreign';
 if found then raise exception 'cross account update'; end if;
 begin
  insert into public.course_progress(user_id,course_id) values('10000000-0000-4000-8000-000000000001','FIN-308');
  raise exception 'cross account insert';
 exception when insufficient_privilege then null;
 end;
end $$;
select public.sync_course_progress('STAT-201',1,array['lesson-4'],'lesson-4','[]'::jsonb);
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.reset_course_progress('STAT-201',1);
do $$ begin
 if (public.read_course_progress('STAT-201')->>'generation')::int<>2 or jsonb_array_length(public.read_course_progress('STAT-201')->'completedLessonIds')<>0 or jsonb_array_length(public.read_course_progress('STAT-201')->'attempts')<>0 then raise exception 'reset failed'; end if;
 if (select count(*) from public.course_attempts)<>1 then raise exception 'historical attempt deleted'; end if;
 begin
  perform public.sync_course_progress('STAT-201',1,array['lesson-1'],'lesson-1','[]'::jsonb);
  raise exception 'old generation replayed';
 exception when raise_exception then if sqlerrm<>'COURSE_GENERATION_CONFLICT' then raise; end if;
 end;
end $$;
reset role;
set role anon;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 begin perform public.read_course_progress('STAT-201');raise exception 'anon RPC allowed';exception when insufficient_privilege then null;end;
 begin perform 1 from public.course_progress;raise exception 'anon table allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
