-- Keep deletion markers so long-offline devices cannot recreate removed paper memories.
alter table public.paper_memories
  add column if not exists deleted_at timestamptz;

create index if not exists paper_memories_user_updated_idx
  on public.paper_memories (user_id, updated_at desc);

create or replace function public.sync_paper_memory(
  p_id text,
  p_title text,
  p_file_name text,
  p_extracted_content jsonb,
  p_ai_memory jsonb,
  p_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  affected integer;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.paper_memories
    (id, user_id, title, file_name, extracted_content, ai_memory, updated_at, deleted_at)
  values
    (p_id, current_user_id, p_title, p_file_name, p_extracted_content, p_ai_memory, p_updated_at, null)
  on conflict (user_id, id) do update set
    title = excluded.title,
    file_name = excluded.file_name,
    extracted_content = excluded.extracted_content,
    ai_memory = excluded.ai_memory,
    updated_at = excluded.updated_at
  where public.paper_memories.deleted_at is null
    and public.paper_memories.updated_at < excluded.updated_at;

  get diagnostics affected = row_count;
  return jsonb_build_object('status', case when affected = 1 then 'synced' else 'stale' end);
end;
$$;

create or replace function public.delete_paper_memory(p_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deletion_time timestamptz := clock_timestamp();
  effective_deletion_time timestamptz;
begin
  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  insert into public.paper_memories
    (id, user_id, title, file_name, extracted_content, ai_memory, updated_at, deleted_at)
  values
    (p_id, current_user_id, '[deleted]', '', '{}'::jsonb, '{}'::jsonb, deletion_time, deletion_time)
  on conflict (user_id, id) do update set
    title = '[deleted]',
    file_name = '',
    extracted_content = '{}'::jsonb,
    ai_memory = '{}'::jsonb,
    updated_at = deletion_time,
    deleted_at = deletion_time
  where public.paper_memories.deleted_at is null
  returning deleted_at into effective_deletion_time;

  if effective_deletion_time is null then
    select deleted_at into effective_deletion_time
    from public.paper_memories
    where user_id = current_user_id and id = p_id;
  end if;

  return jsonb_build_object(
    'status', 'deleted',
    'deletedAt', extract(epoch from effective_deletion_time) * 1000
  );
end;
$$;

revoke execute on function public.sync_paper_memory(text, text, text, jsonb, jsonb, timestamptz)
  from public, anon;
revoke execute on function public.delete_paper_memory(text)
  from public, anon;

grant execute on function public.sync_paper_memory(text, text, text, jsonb, jsonb, timestamptz)
  to authenticated;
grant execute on function public.delete_paper_memory(text)
  to authenticated;
