-- Expand research records and add explicit project membership. Existing projects remain private.
alter table public.research_workbench_records drop constraint research_workbench_records_collection_check;
alter table public.research_workbench_records add constraint research_workbench_records_collection_check check(collection in ('protocol','dataset','literature','specification','run','review','verification','delivery','dependency','writing','design','power','family','join','execution'));
alter table public.research_workbench_records add column actor_id uuid references auth.users(id) on delete set null;
create table public.research_project_members (
 project_id uuid not null references public.learning_projects(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('viewer','editor')),
 version integer not null default 1 check(version>0),
 granted_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 primary key(project_id,user_id)
);
create index research_member_user on public.research_project_members(user_id,project_id) where revoked_at is null;
create table public.research_project_invites (
 id uuid primary key default gen_random_uuid(),
 project_id uuid not null references public.learning_projects(id) on delete cascade,
 operation_id uuid not null,
 code_hash text not null unique check(code_hash ~ '^[a-f0-9]{64}$'),
 role text not null check(role in ('viewer','editor')),
 created_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null default (statement_timestamp()+interval '7 days'),
 claimed_by uuid references auth.users(id) on delete set null,
 claimed_at timestamptz,
 revoked_at timestamptz,
 check(expires_at<=created_at+interval '7 days' and expires_at>created_at),
 unique(project_id,operation_id)
);
alter table public.research_project_members enable row level security;
alter table public.research_project_invites enable row level security;
revoke all on public.research_project_members,public.research_project_invites from public,anon,authenticated;
grant select on public.research_project_members to authenticated;

create function research_private.project_role(p_project_id uuid) returns text language sql stable security definer set search_path='' as $$
 select case when p.user_id=(select auth.uid()) then 'owner' else (select m.role from public.research_project_members m where m.project_id=p.id and m.user_id=(select auth.uid()) and m.revoked_at is null) end
 from public.learning_projects p where p.id=p_project_id and (select auth.uid()) is not null
$$;
revoke all on function research_private.project_role(uuid) from public,anon;
grant execute on function research_private.project_role(uuid) to authenticated;
create policy research_members_visible on public.research_project_members for select to authenticated using(research_private.project_role(project_id) is not null);

drop policy projects_all_own on public.learning_projects;
create policy projects_read_access on public.learning_projects for select to authenticated using(user_id=(select auth.uid()) or research_private.project_role(id) is not null);
create policy projects_insert_owned on public.learning_projects for insert to authenticated with check(user_id=(select auth.uid()));
create policy projects_update_access on public.learning_projects for update to authenticated using(research_private.project_role(id) in ('owner','editor')) with check(research_private.project_role(id) in ('owner','editor'));
create policy projects_delete_owned on public.learning_projects for delete to authenticated using(user_id=(select auth.uid()));
create function public.guard_research_project_owner() returns trigger language plpgsql security invoker set search_path='' as $$begin
 if new.user_id is distinct from old.user_id then raise exception 'WORKBENCH_OWNER_IMMUTABLE' using errcode='42501'; end if;
 new.updated_at:=greatest(clock_timestamp(),old.updated_at+interval '1 microsecond');
 return new;
end;$$;
revoke all on function public.guard_research_project_owner() from public,anon,authenticated;
create trigger guard_research_project_owner before update on public.learning_projects for each row execute function public.guard_research_project_owner();
drop policy research_records_read_own on public.research_workbench_records;
drop policy research_records_insert_own on public.research_workbench_records;
create policy research_records_read_access on public.research_workbench_records for select to authenticated using(research_private.project_role(project_id) is not null);
create policy research_records_write_access on public.research_workbench_records for insert to authenticated with check(research_private.project_role(project_id) in ('owner','editor') and user_id=(select p.user_id from public.learning_projects p where p.id=project_id));

create function public.research_project_access(p_project_id uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('role',research_private.project_role(p.id),'ownerId',p.user_id,'shared',exists(select 1 from public.research_project_members m where m.project_id=p.id and m.revoked_at is null)) from public.learning_projects p where p.id=p_project_id
$$;
revoke all on function public.research_project_access(uuid) from public,anon;
grant execute on function public.research_project_access(uuid) to authenticated;

create function research_private.collaboration(p_action text,p_project_id uuid default null,p_user_id uuid default null,p_role text default null,p_version integer default null,p_operation_id uuid default null,p_code text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.learning_projects; invite public.research_project_invites; member public.research_project_members; code_digest text; result jsonb;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_action in ('preview','accept') then
  if p_code is null or p_code !~ '^[a-f0-9]{48,64}$' then raise exception 'WORKBENCH_INVITE_UNAVAILABLE' using errcode='42501'; end if;
  code_digest:=encode(sha256(convert_to(p_code,'UTF8')),'hex');
  select * into invite from public.research_project_invites i where i.code_hash=code_digest for update;
  if not found or invite.revoked_at is not null or invite.expires_at<=clock_timestamp() then raise exception 'WORKBENCH_INVITE_UNAVAILABLE' using errcode='42501'; end if;
  select * into p from public.learning_projects where id=invite.project_id for update;
  if not found then raise exception 'WORKBENCH_INVITE_UNAVAILABLE' using errcode='42501'; end if;
  if p_action='preview' then return jsonb_build_object('projectId',p.id,'title',p.title,'role',invite.role,'expiresAt',invite.expires_at,'scope','项目资料、研究记录与摘录；不共享原始文件或个人论文库'); end if;
  if p.user_id=auth.uid() then raise exception 'WORKBENCH_OWNER_ALREADY_MEMBER'; end if;
  if invite.claimed_at is not null then
    select * into member from public.research_project_members m where m.project_id=p.id and m.user_id=auth.uid();
    if invite.claimed_by=auth.uid() and member.revoked_at is null and member.user_id is not null then return jsonb_build_object('projectId',p.id,'reused',true,'role',member.role); end if;
    raise exception 'WORKBENCH_INVITE_UNAVAILABLE' using errcode='42501';
  end if;
  insert into public.research_project_members(project_id,user_id,role) values(p.id,auth.uid(),invite.role)
   on conflict(project_id,user_id) do update set role=excluded.role,version=research_project_members.version+1,revoked_at=null,granted_at=clock_timestamp() returning * into member;
  update public.research_project_invites set claimed_by=auth.uid(),claimed_at=clock_timestamp() where id=invite.id;
  return jsonb_build_object('projectId',p.id,'reused',false,'role',member.role);
 end if;
 select * into p from public.learning_projects where id=p_project_id and user_id=auth.uid() for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 if p_action='list' then
  select jsonb_build_object('ownerId',p.user_id,'members',coalesce((select jsonb_agg(to_jsonb(m) order by m.granted_at) from public.research_project_members m where m.project_id=p.id),'[]'::jsonb),'invites',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'role',i.role,'expiresAt',i.expires_at,'claimedAt',i.claimed_at,'revokedAt',i.revoked_at) order by i.created_at desc) from public.research_project_invites i where i.project_id=p.id),'[]'::jsonb)) into result;return result;
 elsif p_action='invite' then
  if p.kind not in ('paper','data','writing','group') or p_operation_id is null or p_code is null or p_code !~ '^[a-f0-9]{48,64}$' or p_role is null or p_role not in ('viewer','editor') then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
  code_digest:=encode(sha256(convert_to(p_code,'UTF8')),'hex');
  select * into invite from public.research_project_invites i where i.project_id=p.id and i.operation_id=p_operation_id;
  if found then
   if invite.code_hash is distinct from code_digest or invite.role is distinct from p_role then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
   return jsonb_build_object('id',invite.id,'expiresAt',invite.expires_at,'role',invite.role);
  end if;
  if (select count(*) from public.research_project_invites i where i.project_id=p.id and i.revoked_at is null and i.claimed_at is null and i.expires_at>clock_timestamp())>=20 then raise exception 'WORKBENCH_CAPACITY'; end if;
  insert into public.research_project_invites(project_id,operation_id,code_hash,role) values(p.id,p_operation_id,code_digest,p_role) returning * into invite;
  return jsonb_build_object('id',invite.id,'expiresAt',invite.expires_at,'role',invite.role);
 elsif p_action='revoke-invite' then
  update public.research_project_invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where project_id=p.id and id=p_operation_id;
  return jsonb_build_object('revoked',true);
 elsif p_action in ('member','revoke-member') then
  if p_user_id is null or p_user_id=p.user_id or p_version is null then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
  select * into member from public.research_project_members m where m.project_id=p.id and m.user_id=p_user_id for update;
  if not found then raise exception 'WORKBENCH_MEMBER_UNAVAILABLE'; end if;
  if p_action='member' and (p_role is null or p_role not in ('viewer','editor')) then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
  if member.version<>p_version then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
  -- Revocation/downgrade also invalidates outstanding bearer invitations.
  update public.research_project_invites set revoked_at=coalesce(revoked_at,clock_timestamp()) where project_id=p.id and claimed_at is null;
  update public.research_project_members set role=case when p_action='member' then p_role else role end,revoked_at=case when p_action='revoke-member' then coalesce(revoked_at,clock_timestamp()) else null end,version=version+1 where project_id=p.id and user_id=p_user_id returning * into member;
  return to_jsonb(member);
 end if;
 raise exception 'WORKBENCH_INVALID_INPUT';
end;$$;
revoke all on function research_private.collaboration(text,uuid,uuid,text,integer,uuid,text) from public,anon;
grant execute on function research_private.collaboration(text,uuid,uuid,text,integer,uuid,text) to authenticated;
create function public.research_collaboration(p_action text,p_project_id uuid default null,p_user_id uuid default null,p_role text default null,p_version integer default null,p_operation_id uuid default null,p_code text default null) returns jsonb language sql security invoker set search_path='' as $$select research_private.collaboration(p_action,p_project_id,p_user_id,p_role,p_version,p_operation_id,p_code)$$;
revoke all on function public.research_collaboration(text,uuid,uuid,text,integer,uuid,text) from public,anon;
grant execute on function public.research_collaboration(text,uuid,uuid,text,integer,uuid,text) to authenticated;

create function public.save_research_connected_record(p_project_id uuid,p_collection text,p_entity_id uuid,p_expected_revision integer,p_payload jsonb,p_archived boolean,p_expected_sequence bigint,p_expected_updated_at timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; current_sequence bigint; previous public.research_workbench_records;
begin
 select * into p from public.learning_projects where id=p_project_id and research_private.project_role(id) in ('owner','editor') for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 select * into previous from public.research_workbench_records where project_id=p.id and entity_id=p_entity_id order by revision desc limit 1;
 if previous.revision=p_expected_revision+1 and previous.collection=p_collection and previous.payload=p_payload and previous.archived=p_archived then return to_jsonb(previous); end if;
 select coalesce(max(sequence),0) into current_sequence from public.research_workbench_records where project_id=p.id;
 if current_sequence is distinct from p_expected_sequence or p.updated_at is distinct from p_expected_updated_at then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
 return public.save_research_record(p_project_id,p_collection,p_entity_id,p_expected_revision,p_payload,p_archived,null);
end;$$;
revoke all on function public.save_research_connected_record(uuid,text,uuid,integer,jsonb,boolean,bigint,timestamptz) from public,anon;
grant execute on function public.save_research_connected_record(uuid,text,uuid,integer,jsonb,boolean,bigint,timestamptz) to authenticated;


-- Preserve original RPC signatures while enforcing project membership and immutable authorship.
create or replace function public.guard_research_record_insert() returns trigger language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; previous public.research_workbench_records; total_count integer; total_bytes bigint;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into p from public.learning_projects where id=new.project_id and research_private.project_role(id) in ('owner','editor') for update;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 new.user_id:=p.user_id; new.actor_id:=auth.uid(); new.created_at:=clock_timestamp();
 select * into previous from public.research_workbench_records where project_id=new.project_id and entity_id=new.entity_id order by revision desc limit 1;
 if new.revision<>coalesce(previous.revision,0)+1 or (previous.id is not null and previous.collection<>new.collection) then raise exception 'WORKBENCH_REVISION_CONFLICT' using errcode='40001'; end if;
 if new.collection in ('protocol','run','verification','delivery','join','execution') and (new.revision<>1 or new.archived) then raise exception 'WORKBENCH_APPEND_ONLY'; end if;
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

create or replace function public.save_research_record(p_project_id uuid,p_collection text,p_entity_id uuid,p_expected_revision integer,p_payload jsonb,p_archived boolean default false,p_project_updated_at timestamptz default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; previous public.research_workbench_records; saved public.research_workbench_records; normalized jsonb:=p_payload;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>9999 or p_archived is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
 select * into p from public.learning_projects where id=p_project_id and research_private.project_role(id) in ('owner','editor') for update;
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

create or replace function public.export_research_project(p_project_id uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; records jsonb;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 select * into p from public.learning_projects where id=p_project_id and research_private.project_role(id) is not null for share;
 if not found then raise exception 'WORKBENCH_PROJECT_UNAVAILABLE' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.sequence),'[]'::jsonb) into records from public.research_workbench_records r where r.project_id=p_project_id;
 return jsonb_build_object('project',jsonb_build_object('id',p.id,'title',p.title,'kind',p.kind,'status',p.status,'metadata',p.metadata,'updated_at',p.updated_at),'events',records,'access',public.research_project_access(p.id));
end;
$$;

create or replace function public.restore_research_protocol(p_project_id uuid,p_entity_id uuid,p_operation_id uuid,p_expected_updated_at timestamptz,p_reason text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare p public.learning_projects; source public.research_workbench_records; existing public.research_workbench_records; record public.research_workbench_records; research jsonb;
begin
 if auth.uid() is null then raise exception 'WORKBENCH_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_reason is null or length(trim(p_reason)) not between 1 and 2000 then raise exception 'WORKBENCH_INVALID_INPUT'; end if;
 select * into p from public.learning_projects where id=p_project_id and research_private.project_role(id) in ('owner','editor') for update;
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
 update public.learning_projects set metadata=jsonb_set(metadata,'{research}',research,true),updated_at=clock_timestamp() where id=p_project_id and research_private.project_role(id) in ('owner','editor') returning * into p;
 insert into public.research_workbench_records(project_id,collection,entity_id,revision,payload) values(p_project_id,'protocol',p_operation_id,1,jsonb_build_object('title',source.payload->>'title','reason',trim(p_reason),'phase','amendment','protocol',source.payload->'protocol','restoredFrom',p_entity_id)) returning * into record;
 return jsonb_build_object('project',to_jsonb(p),'event',to_jsonb(record));
end;
$$;

create function public.list_research_project_access() returns jsonb language sql stable security invoker set search_path='' as $$select coalesce(jsonb_object_agg(p.id::text,research_private.project_role(p.id)),'{}'::jsonb) from public.learning_projects p$$;
revoke all on function public.list_research_project_access() from public,anon;
grant execute on function public.list_research_project_access() to authenticated;

-- Restored copies retain original authorship in bounded provenance; membership is never imported.
create or replace function research_private.restore_research_project(p_import_id uuid,p_title text,p_kind text,p_status text,p_metadata jsonb,p_events jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
       jsonb_build_object('originalActorId',coalesce(item#>>'{origin,originalActorId}',item->>'actor_id',item->>'user_id'),'originalEventId',coalesce(item#>>'{origin,originalEventId}',item->>'id'),'originalCreatedAt',coalesce(item#>>'{origin,originalCreatedAt}',item->>'created_at'),'originalProjectId',coalesce(item#>>'{origin,originalProjectId}',item->>'project_id'),'restoredFromEventId',item->>'id','restoredFromCreatedAt',item->>'created_at','previousOriginHash',encode(sha256(convert_to(coalesce(item->'origin','null'::jsonb)::text,'UTF8')),'hex')));
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
