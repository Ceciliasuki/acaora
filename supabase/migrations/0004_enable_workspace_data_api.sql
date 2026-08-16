-- Expose only authenticated, user-owned workspace records through the Data API.
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.paper_memories to authenticated;
grant select, insert, update, delete on public.learning_projects to authenticated;

revoke all on public.profiles from anon;
revoke all on public.paper_memories from anon;
revoke all on public.learning_projects from anon;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "papers_all_own" on public.paper_memories;
drop policy if exists "projects_all_own" on public.learning_projects;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = id);
create policy "papers_all_own" on public.paper_memories
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
create policy "projects_all_own" on public.learning_projects
  for all to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);
