import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
test('Postgres enforces course ownership, atomic merging, retries and reset generations',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 insert into auth.users values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002');
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'))::uuid$$;
 grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261003014230_curated_course_progress.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../supabase/tests/course_progress.sql',import.meta.url),'utf8'));
 const {rows}=await db.query(`select user_id,generation,completed_lesson_ids from public.course_progress order by user_id`);
 assert.equal(rows.length,2);assert.equal(rows[0].generation,2);assert.deepEqual(rows[0].completed_lesson_ids,[]);assert.deepEqual(rows[1].completed_lesson_ids,['lesson-4']);
 } finally {await db.close();}
});
