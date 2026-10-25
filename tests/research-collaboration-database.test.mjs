import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
const owner='10000000-0000-4000-8000-000000000001',editor='10000000-0000-4000-8000-000000000002',viewer='10000000-0000-4000-8000-000000000003',stranger='10000000-0000-4000-8000-000000000004',project='20000000-0000-4000-8000-000000000001';
test('explicit invitations enforce role boundaries, authorship, revocation and connected-record concurrency',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${owner}'),('${editor}'),('${viewer}'),('${stranger}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
 for(const name of ['0001_acaora_accounts.sql','0004_enable_workspace_data_api.sql','20261024144054_research_workbench_records.sql','20261025041118_research_connections_and_collaboration.sql'])await db.exec(await readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8'));
 const as=async user=>db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${user}',false);`);
 await as(owner);await db.query(`insert into public.learning_projects(id,user_id,title,kind,metadata) values($1,$2,'Shared study','paper','{}') returning id`,[project,owner]);
 const call=async(action,{projectId=project,userId=null,role=null,version=null,operation=null,code=null}={})=>(await db.query('select public.research_collaboration($1,$2,$3,$4,$5,$6,$7) as result',[action,projectId,userId,role,version,operation,code])).rows[0].result;
 const invite=await call('invite',{role:'editor',operation:'30000000-0000-4000-8000-000000000001',code:'a'.repeat(48)});
 assert.equal((await call('invite',{role:'editor',operation:'30000000-0000-4000-8000-000000000001',code:'a'.repeat(48)})).id,invite.id);
 await call('invite',{role:'viewer',operation:'30000000-0000-4000-8000-000000000002',code:'b'.repeat(48)});
 await as(stranger);assert.equal((await db.query('select * from public.learning_projects')).rows.length,0);await assert.rejects(()=>call('list'),/UNAVAILABLE/);await assert.rejects(()=>call('preview',{code:'x'.repeat(48)}),/INVITE_UNAVAILABLE/);
 await as(editor);assert.equal((await call('preview',{code:'a'.repeat(48)})).role,'editor');const joined=await call('accept',{code:'a'.repeat(48)});assert.equal(joined.projectId,project);assert.equal((await call('accept',{code:'a'.repeat(48)})).reused,true);await assert.rejects(()=>call('invite',{role:'editor',operation:project,code:'c'.repeat(48)}),/UNAVAILABLE/);
 await db.query(`update public.learning_projects set metadata='{"notes":"Edited collaboratively"}' where id=$1 returning id`,[project]);
 await assert.rejects(()=>db.query('update public.learning_projects set user_id=$1 where id=$2',[editor,project]),/OWNER_IMMUTABLE/);
 assert.equal((await db.query('delete from public.learning_projects where id=$1 returning id',[project])).rows.length,0);
 const event=(await db.query(`select public.save_research_record($1,'review',$2,0,'{"title":"Member audit"}',false,null) as event`,[project,'40000000-0000-4000-8000-000000000001'])).rows[0].event;assert.equal(event.user_id,owner);assert.equal(event.actor_id,editor);
 const bundle=(await db.query('select public.export_research_project($1) as bundle',[project])).rows[0].bundle;assert.equal(bundle.access.role,'editor');assert.equal(bundle.events.length,1);
 const connected=async(seq,stamp)=>(await db.query(`select public.save_research_connected_record($1,'writing',$2,0,'{"title":"Connected draft"}',false,$3,$4) as event`,[project,'40000000-0000-4000-8000-000000000002',seq,stamp])).rows[0].event;
 await assert.rejects(()=>connected(0,bundle.project.updated_at),/REVISION_CONFLICT/);const written=await connected(event.sequence,bundle.project.updated_at);assert.equal((await connected(0,'2000-01-01T00:00:00Z')).id,written.id);
 await as(viewer);await call('accept',{code:'b'.repeat(48)});assert.equal((await db.query('select * from public.learning_projects')).rows.length,1);assert.equal((await db.query('update public.learning_projects set title=\'No\' where id=$1 returning id',[project])).rows.length,0);await assert.rejects(()=>db.query(`select public.save_research_record($1,'review',$2,0,'{}',false,null)`,[project,'40000000-0000-4000-8000-000000000003']),/UNAVAILABLE/);await assert.rejects(()=>call('member',{userId:editor,role:'editor',version:1}),/UNAVAILABLE/);
 await as(owner);const members=await call('list');assert.equal(members.members.length,2);assert.equal(JSON.stringify(members).includes('code_hash'),false);await call('revoke-member',{userId:editor,version:1});
 await as(editor);assert.equal((await db.query('select * from public.learning_projects')).rows.length,0);assert.equal((await db.query('select * from public.research_workbench_records')).rows.length,0);await assert.rejects(()=>call('accept',{code:'a'.repeat(48)}),/INVITE_UNAVAILABLE/);await assert.rejects(()=>db.query('select public.export_research_project($1)',[project]),/UNAVAILABLE/);
 await db.exec('set role anon;');await assert.rejects(()=>db.query('select public.research_collaboration(\'preview\',null,null,null,null,null,$1)',['a'.repeat(48)]),/permission denied/);
 }finally{await db.close();}
});
