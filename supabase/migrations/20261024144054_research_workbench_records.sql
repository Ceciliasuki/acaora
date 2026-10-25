-- Additive record ledger. Existing project JSON and paper/course records are not migrated.
create table public.research_workbench_records (
 id uuid primary key default gen_random_uuid(),
 sequence bigint generated always as identity unique,
 project_id uuid not null references public.learning_projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 collection text not null check (collection in ('protocol','dataset','literature','specification','run','review','verification','delivery')),
 entity_id uuid not null,
 revision integer not null check (revision between 1 and 10000),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=262144),
 archived boolean not null default false,
 created_at timestamptz not null default clock_timestamp(),
 origin jsonb check (origin is null or (jsonb_typeof(origin)='object' and octet_length(origin::text)<=1024)),
 unique(project_id,entity_id,revision)
);
create index research_workbench_project_sequence on public.research_workbench_records(project_id,sequence);
create index research_workbench_owner on public.research_workbench_records(user_id);
create table public.research_project_imports (
 user_id uuid not null references auth.users(id) on delete cascade,
 import_id uuid not null,
 -- Deliberately keep this receipt after a restored project is deleted: retry must not resurrect it.
 project_id uuid not null,
 request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default clock_timestamp(),
 primary key(user_id,import_id)
);
alter table public.research_workbench_records enable row level security;
alter table public.research_project_imports enable row level security;
revoke all on public.research_workbench_records,public.research_project_imports from public,anon,authenticated;
grant select on public.research_workbench_records,public.research_project_imports to authenticated;
grant insert(project_id,collection,entity_id,revision,payload,archived) on public.research_workbench_records to authenticated;
grant insert(user_id,import_id,project_id,request_hash) on public.research_project_imports to authenticated;
grant usage on sequence public.research_workbench_records_sequence_seq to authenticated;
create policy research_records_read_own on public.research_workbench_records for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.learning_projects p where p.id=project_id and p.user_id=(select auth.uid())));
create policy research_records_insert_own on public.research_workbench_records for insert to authenticated
 with check(user_id=(select auth.uid()) and exists(select 1 from public.learning_projects p where p.id=project_id and p.user_id=(select auth.uid())));
create policy research_imports_read_own on public.research_project_imports for select to authenticated using(user_id=(select auth.uid()));
create policy research_imports_insert_own on public.research_project_imports for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.learning_projects p where p.id=project_id and p.user_id=(select auth.uid())));

create function public.guard_research_record_insert() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; previous public.research_workbench_records; total_count integer; total_bytes bigint;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into p from public.learning_projects where id=new.project_id and user_id=auth.uid() for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 new.user_id:=auth.uid(); new.created_at:=clock_timestamp();
 select * into previous from public.research_workbench_records where project_id=new.project_id and entity_id=new.entity_id order by revision desc limit 1;
 if new.revision<>coalesce(previous.revision,0)+1 or (previous.id is not null and previous.collection<>new.collection) then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
 if new.collection in ('protocol','run','verification','delivery') and (new.revision<>1 or new.archived) then raise exception 'WORKBENCH_APPEND_ONLY'; end if;
 if new.collection='protocol' and new.origin is null then
   if jsonb_typeof(p.metadata#>'{research,protocol}') is distinct from 'object' then raise exception 'WORKBENCH_SAVE_RESEARCH_FIRST'; end if;
   new.payload:=jsonb_set(new.payload,'{protocol}',p.metadata#>'{research,protocol}',true);
   if new.payload->>'phase'='before-analysis' and ((jsonb_typeof(p.metadata->'analysisRecords')='array' and jsonb_array_length(p.metadata->'analysisRecords')>0) or exists(select 1 from public.research_workbench_records r where r.project_id=p.id and r.collection='run')) then raise exception 'WORKBENCH_PHASE_CONFLICT'; end if;
 end if;
 -- Reserve 2 KiB per event for fixed columns and bounded import provenance.
 -- The same budget applies before/after restore; accepted ledgers always fit the backup envelope.
 select count(*),coalesce(sum(octet_length(payload::text)+2048),0) into total_count,total_bytes from public.research_workbench_records where project_id=new.project_id;
 if total_count>=2000 or total_bytes+octet_length(new.payload::text)+2048>8388608 then raise exception 'WORKBENCH_CAPACITY'; end if;
 return new;
end;
$$;
revoke all on function public.guard_research_record_insert() from public,anon,authenticated;
create trigger guard_research_record before insert on public.research_workbench_records for each row execute function public.guard_research_record_insert();

create function public.save_research_record(p_project_id uuid,p_collection text,p_entity_id uuid,p_expected_revision integer,p_payload jsonb,p_archived boolean default false,p_project_updated_at timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; previous public.research_workbench_records; saved public.research_workbench_records; normalized jsonb:=p_payload;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9999 or p_archived is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
 select * into p from public.learning_projects where id=p_project_id and user_id=auth.uid() for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 if p_collection='protocol' then
   if p_project_updated_at is null or p.updated_at<>p_project_updated_at then raise exception 'WORKBENCH_PROJECT_VERSION_CONFLICT' using errcode='40001'; end if;
   if jsonb_typeof(p.metadata#>'{research,protocol}') is distinct from 'object' then raise exception 'WORKBENCH_SAVE_RESEARCH_FIRST'; end if;
   normalized:=jsonb_set(normalized,'{protocol}',p.metadata#>'{research,protocol}',true);
 end if;
 select * into previous from public.research_workbench_records where project_id=p_project_id and entity_id=p_entity_id order by revision desc limit 1;
 if previous.id is not null and previous.revision=p_expected_revision+1 and previous.collection=p_collection and previous.payload=normalized and previous.archived=p_archived then return to_jsonb(previous); end if;
 if coalesce(previous.revision,0)<>p_expected_revision then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
 insert into public.research_workbench_records(project_id,collection,entity_id,revision,payload,archived)
 values(p_project_id,p_collection,p_entity_id,p_expected_revision+1,normalized,p_archived) returning * into saved;
 return to_jsonb(saved);
end;
$$;

create function public.export_research_project(p_project_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; records jsonb;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into p from public.learning_projects where id=p_project_id and user_id=auth.uid() for share;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.sequence),'[]'::jsonb) into records from public.research_workbench_records r where r.project_id=p_project_id;
 return jsonb_build_object('project',jsonb_build_object('id',p.id,'title',p.title,'kind',p.kind,'status',p.status,'metadata',p.metadata,'updated_at',p.updated_at),'events',records);
end;
$$;

create schema if not exists research_private;
revoke all on schema research_private from public,anon;
grant usage on schema research_private to authenticated;
create function research_private.restore_research_project(p_import_id uuid,p_title text,p_kind text,p_status text,p_metadata jsonb,p_events jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner uuid:=auth.uid(); target uuid; item jsonb; receipt public.research_project_imports; request_hash text;
begin
 if owner is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 request_hash:=encode(sha256(convert_to(jsonb_build_object('title',trim(p_title),'kind',p_kind,'status',p_status,'metadata',p_metadata,'events',p_events)::text,'UTF8')),'hex');
 select * into receipt from public.research_project_imports where user_id=owner and import_id=p_import_id;
 if found then
   if receipt.request_hash<>request_hash then raise exception 'WORKBENCH_IMPORT_OPERATION_CONFLICT' using errcode='40001'; end if;
   if not exists(select 1 from public.learning_projects where id=receipt.project_id and user_id=owner) then raise exception 'WORKBENCH_IMPORT_TARGET_DELETED'; end if;
   return jsonb_build_object('projectId',receipt.project_id,'reused',true);
 end if;
 if p_title is null or length(trim(p_title)) not between 1 and 120 or p_kind not in ('course','paper','data','writing','group','career') or p_status not in ('active','paused','completed') or jsonb_typeof(p_metadata) is distinct from 'object' or octet_length(p_metadata::text)>1048576 or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>2000 then raise exception 'WORKBENCH_INVALID_BACKUP'; end if;
 begin
   insert into public.learning_projects(user_id,title,kind,status,metadata) values(owner,trim(p_title),p_kind,p_status,p_metadata) returning id into target;
   for item in select value from jsonb_array_elements(p_events) order by (value->>'sequence')::bigint loop
     insert into public.research_workbench_records(project_id,collection,entity_id,revision,payload,archived,origin)
     values(target,item->>'collection',(item->>'entity_id')::uuid,(item->>'revision')::integer,item->'payload',(item->>'archived')::boolean,
       jsonb_build_object('originalEventId',coalesce(item#>>'{origin,originalEventId}',item->>'id'),'originalCreatedAt',coalesce(item#>>'{origin,originalCreatedAt}',item->>'created_at'),'originalProjectId',coalesce(item#>>'{origin,originalProjectId}',item->>'project_id'),'restoredFromEventId',item->>'id','restoredFromCreatedAt',item->>'created_at','previousOriginHash',encode(sha256(convert_to(coalesce(item->'origin','null'::jsonb)::text,'UTF8')),'hex')));
   end loop;
   insert into public.research_project_imports(user_id,import_id,project_id,request_hash) values(owner,p_import_id,target,request_hash);
 exception when unique_violation then
   select * into receipt from public.research_project_imports where user_id=owner and import_id=p_import_id;
   if not found then raise; end if;
   if receipt.request_hash<>request_hash then raise exception 'WORKBENCH_IMPORT_OPERATION_CONFLICT' using errcode='40001'; end if;
   if not exists(select 1 from public.learning_projects where id=receipt.project_id and user_id=owner) then raise exception 'WORKBENCH_IMPORT_TARGET_DELETED'; end if;
   return jsonb_build_object('projectId',receipt.project_id,'reused',true);
 end;
 return jsonb_build_object('projectId',target,'reused',false);
end;
$$;
revoke all on function research_private.restore_research_project(uuid,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function research_private.restore_research_project(uuid,text,text,text,jsonb,jsonb) to authenticated;
create function public.restore_research_project(p_import_id uuid,p_title text,p_kind text,p_status text,p_metadata jsonb,p_events jsonb) returns jsonb language sql security invoker set search_path='' as $$
 select research_private.restore_research_project(p_import_id,p_title,p_kind,p_status,p_metadata,p_events);
$$;
revoke all on function public.save_research_record(uuid,text,uuid,integer,jsonb,boolean,timestamptz),public.export_research_project(uuid),public.restore_research_project(uuid,text,text,text,jsonb,jsonb) from public,anon;
grant execute on function public.save_research_record(uuid,text,uuid,integer,jsonb,boolean,timestamptz),public.export_research_project(uuid),public.restore_research_project(uuid,text,text,text,jsonb,jsonb) to authenticated;

create function public.restore_research_protocol(p_project_id uuid,p_entity_id uuid,p_operation_id uuid,p_expected_updated_at timestamptz,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; source public.research_workbench_records; existing public.research_workbench_records; record public.research_workbench_records; research jsonb;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 2000 then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
 select * into p from public.learning_projects where id=p_project_id and user_id=auth.uid() for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 select * into existing from public.research_workbench_records where project_id=p_project_id and entity_id=p_operation_id;
 if found then
   if existing.collection is distinct from 'protocol' or existing.payload->>'restoredFrom' is distinct from p_entity_id::text or existing.payload->>'reason' is distinct from trim(p_reason) then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
   return jsonb_build_object('project',to_jsonb(p),'event',to_jsonb(existing));
 end if;
 if p_expected_updated_at is null or p.updated_at<>p_expected_updated_at then raise exception 'WORKBENCH_PROJECT_VERSION_CONFLICT' using errcode='40001'; end if;
 select * into source from public.research_workbench_records where project_id=p_project_id and entity_id=p_entity_id and collection='protocol';
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 research:=coalesce(p.metadata->'research','{"version":1,"findings":[]}'::jsonb);
 research:=jsonb_set(research,'{protocol}',source.payload->'protocol',true);
 if length(jsonb_set(p.metadata,'{research}',research,true)::text)>120000 then raise exception 'WORKBENCH_CAPACITY'; end if;
 update public.learning_projects set metadata=jsonb_set(metadata,'{research}',research,true),updated_at=clock_timestamp() where id=p_project_id and user_id=auth.uid() returning * into p;
 insert into public.research_workbench_records(project_id,collection,entity_id,revision,payload) values(p_project_id,'protocol',p_operation_id,1,jsonb_build_object('title',source.payload->>'title','reason',trim(p_reason),'phase','amendment','protocol',source.payload->'protocol','restoredFrom',p_entity_id)) returning * into record;
 return jsonb_build_object('project',to_jsonb(p),'event',to_jsonb(record));
end;
$$;
revoke all on function public.restore_research_protocol(uuid,uuid,uuid,timestamptz,text) from public,anon;
grant execute on function public.restore_research_protocol(uuid,uuid,uuid,timestamptz,text) to authenticated;
