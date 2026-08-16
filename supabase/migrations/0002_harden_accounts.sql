-- Harden account helpers and optimize user-scoped policies.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create index if not exists paper_memories_user_id_idx
  on public.paper_memories (user_id);

create index if not exists learning_projects_user_id_idx
  on public.learning_projects (user_id);

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "papers_all_own" on public.paper_memories;
drop policy if exists "projects_all_own" on public.learning_projects;

create policy "profiles_select_own" on public.profiles
  for select using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy "papers_all_own" on public.paper_memories
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "projects_all_own" on public.learning_projects
  for all using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
