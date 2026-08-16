-- Keep the automatic RLS event trigger internal to the database.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
