-- Additive course records. Existing papers/projects and global grants are untouched.
create table public.course_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id text not null check (course_id in ('STAT-201','ECON-204','STAT-302','ECON-301','STAT-306','TRADE-305','FIN-308')),
  generation integer not null default 1 check (generation > 0),
  completed_lesson_ids text[] not null default '{}' check (cardinality(completed_lesson_ids)<=256),
  last_lesson_id text,
  updated_at timestamptz not null default now(),
  primary key(user_id,course_id)
);
create table public.course_attempts (
  user_id uuid not null,
  attempt_id uuid not null,
  course_id text not null,
  generation integer not null check(generation>0),
  question_id text not null check(length(question_id) between 1 and 120),
  question_version integer not null check(question_version>0),
  answer text not null check(length(answer)<=8000),
  viewed_solution boolean not null,
  created_at bigint not null check(created_at>=0 and created_at<=8640000000000000),
  primary key(user_id,attempt_id),
  foreign key(user_id,course_id) references public.course_progress(user_id,course_id) on delete cascade
);
create index course_attempts_current on public.course_attempts(user_id,course_id,generation,created_at);
alter table public.course_progress enable row level security;
alter table public.course_attempts enable row level security;
create policy course_progress_select on public.course_progress for select to authenticated using ((select auth.uid())=user_id);
create policy course_progress_insert on public.course_progress for insert to authenticated with check ((select auth.uid())=user_id);
create policy course_progress_update on public.course_progress for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy course_attempts_select on public.course_attempts for select to authenticated using ((select auth.uid())=user_id);
create policy course_attempts_insert on public.course_attempts for insert to authenticated with check ((select auth.uid())=user_id);
revoke all on public.course_progress,public.course_attempts from public,anon,authenticated;
grant select,insert,update on public.course_progress to authenticated;
grant select,insert on public.course_attempts to authenticated;

create function public.read_course_progress(p_course text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.course_progress; owner uuid:=auth.uid(); result jsonb;
begin
  if owner is null then raise exception 'COURSE_AUTH_REQUIRED' using errcode='42501'; end if;
  select * into p from public.course_progress where user_id=owner and course_id=p_course;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.attempt_id,'questionId',a.question_id,'questionVersion',a.question_version,'answer',a.answer,'viewedSolution',a.viewed_solution,'createdAt',a.created_at) order by a.created_at,a.attempt_id),'[]'::jsonb) into result
    from public.course_attempts a where a.user_id=owner and a.course_id=p_course and a.generation=coalesce(p.generation,1);
  return jsonb_build_object('courseId',p_course,'generation',coalesce(p.generation,1),'completedLessonIds',coalesce(p.completed_lesson_ids,'{}'::text[]),'lastLessonId',p.last_lesson_id,'attempts',result);
end;
$$;

create function public.sync_course_progress(p_course text,p_generation integer,p_completed text[],p_last text,p_attempts jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare owner uuid:=auth.uid(); current_generation integer; item jsonb; existing public.course_attempts;
begin
  if owner is null then raise exception 'COURSE_AUTH_REQUIRED' using errcode='42501'; end if;
  if p_generation is null or p_generation<1 or p_completed is null or cardinality(p_completed)>256 or p_attempts is null or jsonb_typeof(p_attempts)<>'array' or jsonb_array_length(p_attempts)>50 then raise exception 'COURSE_INVALID_INPUT'; end if;
  insert into public.course_progress(user_id,course_id) values(owner,p_course) on conflict do nothing;
  select generation into current_generation from public.course_progress where user_id=owner and course_id=p_course for update;
  if current_generation<>p_generation then raise exception 'COURSE_GENERATION_CONFLICT'; end if;
  update public.course_progress set completed_lesson_ids=(select coalesce(array_agg(distinct x order by x),'{}'::text[]) from unnest(completed_lesson_ids||p_completed) x),last_lesson_id=coalesce(p_last,last_lesson_id),updated_at=now() where user_id=owner and course_id=p_course;
  for item in select value from jsonb_array_elements(p_attempts) loop
    select * into existing from public.course_attempts where user_id=owner and attempt_id=(item->>'id')::uuid;
    if found then
      if existing.course_id<>p_course or existing.generation<>p_generation or existing.question_id is distinct from item->>'questionId' or existing.question_version is distinct from (item->>'questionVersion')::integer or existing.answer is distinct from item->>'answer' or existing.viewed_solution is distinct from (item->>'viewedSolution')::boolean or existing.created_at is distinct from (item->>'createdAt')::bigint then raise exception 'COURSE_ATTEMPT_CONFLICT'; end if;
    else
      insert into public.course_attempts(user_id,attempt_id,course_id,generation,question_id,question_version,answer,viewed_solution,created_at)
      values(owner,(item->>'id')::uuid,p_course,p_generation,item->>'questionId',(item->>'questionVersion')::integer,item->>'answer',(item->>'viewedSolution')::boolean,(item->>'createdAt')::bigint);
    end if;
  end loop;
  return public.read_course_progress(p_course);
end;
$$;

create function public.reset_course_progress(p_course text,p_generation integer) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare owner uuid:=auth.uid(); current_generation integer;
begin
  if owner is null then raise exception 'COURSE_AUTH_REQUIRED' using errcode='42501'; end if;
  insert into public.course_progress(user_id,course_id) values(owner,p_course) on conflict do nothing;
  select generation into current_generation from public.course_progress where user_id=owner and course_id=p_course for update;
  if p_generation is null or current_generation<>p_generation then raise exception 'COURSE_GENERATION_CONFLICT'; end if;
  update public.course_progress set generation=generation+1,completed_lesson_ids='{}',last_lesson_id=null,updated_at=now() where user_id=owner and course_id=p_course;
  return public.read_course_progress(p_course);
end;
$$;
revoke all on function public.read_course_progress(text),public.sync_course_progress(text,integer,text[],text,jsonb),public.reset_course_progress(text,integer) from public,anon;
grant execute on function public.read_course_progress(text),public.sync_course_progress(text,integer,text[],text,jsonb),public.reset_course_progress(text,integer) to authenticated;
