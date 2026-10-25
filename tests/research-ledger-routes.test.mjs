import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {createHash} from 'node:crypto';

// Exercise the actual route handlers and validation helpers in memory. Only
// Next's response adapter and the authenticated REST boundary are replaced;
// no production services, credentials, database or network are involved.
async function routeHarness(path) {
  const state = {
    session: {accessToken: 'isolated-test-token', user: {id: 'isolated-test-owner'}},
    calls: [],
    payload: [],
    status: 200,
  };
  const json = (value, init = {}) => new Response(JSON.stringify(value), {
    ...init, headers: {'Content-Type': 'application/json', ...init.headers},
  });
  const shared = {
    readRequestSession: async () => state.session,
    supabaseRest: async (resource, accessToken, init = {}) => {
      state.calls.push({resource, accessToken, init: structuredClone(init)});
      return json(typeof state.payload==='function'?state.payload(resource,init):state.payload, {status: state.status});
    },
    privateNoStore: response => {response.headers.set('Cache-Control', 'private, no-store, max-age=0'); return response;},
    authError: error => json({error: error instanceof Error ? error.message : String(error)}, {status: 500}),
  };
  const cache = new Map();
  async function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const source = await readFile(url, 'utf8');
    const compiled = ts.transpileModule(source, {fileName: url.pathname, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    }}).outputText;
    const dependencies = new Map();
    for (const match of compiled.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      const specifier = match[2];
      if (dependencies.has(specifier)) continue;
      if (specifier === 'next/server') {
        dependencies.set(specifier, {NextResponse: {json}, NextRequest: Request});
      } else if (specifier.startsWith('.')) {
        const dependency = new URL(/\.(?:ts|js|mjs)$/.test(specifier) ? specifier : `${specifier}.ts`, url);
        dependencies.set(specifier, dependency.pathname.endsWith('/api/auth/_shared.ts') ? shared : await load(dependency));
      } else {
        dependencies.set(specifier, await import(specifier));
      }
    }
    const loadedModule = {exports: {}};
    const require = specifier => {
      assert.ok(dependencies.has(specifier), `Unresolved module ${specifier}`);
      return dependencies.get(specifier);
    };
    new Function('require', 'module', 'exports', compiled)(require, loadedModule, loadedModule.exports);
    cache.set(url.href, loadedModule.exports);
    return loadedModule.exports;
  }
  return {state, route: await load(new URL(path, import.meta.url))};
}

function request(path, method, payload) {
  const url = new URL(path, 'https://isolated.test');
  const value = new Request(url, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
  Object.defineProperty(value, 'nextUrl', {value: url});
  return value;
}


const owner='10000000-0000-4000-8000-000000000001',project='20000000-0000-4000-8000-000000000001',entity='30000000-0000-4000-8000-000000000001';
const payload={title:'Review source',category:'source',severity:'major',status:'open',assignee:'',comment:'',resolution:'',links:[]};
const record={id:'40000000-0000-4000-8000-000000000001',sequence:1,project_id:project,user_id:owner,collection:'review',entity_id:entity,revision:1,payload,archived:false,created_at:'2026-10-24T12:00:00.000Z',origin:null};
test('ledger API authenticates, validates strict input and forwards owner-scoped commands without cache',async()=>{
 const {state,route}=await routeHarness('../app/api/projects/workbench/route.ts');state.session.user.id=owner;
 const body={projectId:project,kind:'review',entityId:entity,expectedRevision:0,payload,archived:false,expectedOwnerId:owner};state.payload=record;
 let response=await route.POST(request('/api/projects/workbench','POST',body));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);assert.equal(state.calls[0].resource,'rpc/save_research_record');assert.equal(JSON.parse(state.calls[0].init.body).p_entity_id,entity);
 const count=state.calls.length;
 for(const invalid of [null,{...body,expectedOwnerId:'foreign-owner'},{...body,payload:{...payload,status:['open']}},{...body,unexpected:true}]){
  response=await route.POST(request('/api/projects/workbench','POST',invalid));assert.ok([400,409].includes(response.status));assert.equal(state.calls.length,count);
 }
 state.session=null;assert.equal((await route.GET({nextUrl:new URL('https://isolated.test/api/projects/workbench?project='+project)})).status,401);assert.equal(state.calls.length,count);
});
test('protocol restore validates frozen target and reports concurrency conflicts without overwriting input',async()=>{
 const {state,route}=await routeHarness('../app/api/projects/workbench/route.ts');state.session.user.id=owner;
 for(const invalid of [null,[],{projectId:project,entityId:entity,expectedOwnerId:owner}])assert.equal((await route.PATCH(request('/api/projects/workbench','PATCH',invalid))).status,400);
 assert.equal(state.calls.length,0);
 state.status=409;state.payload={message:'WORKBENCH_PROJECT_VERSION_CONFLICT',code:'40001'};
 const response=await route.PATCH(request('/api/projects/workbench','PATCH',{projectId:project,entityId:entity,operationId:'50000000-0000-4000-8000-000000000001',projectUpdatedAt:'2026-10-24T12:00:00Z',reason:'Restore original design',expectedOwnerId:owner}));
 assert.equal(response.status,409);assert.match((await response.json()).error,/输入保留/);assert.equal(state.calls[0].resource,'rpc/restore_research_protocol');
});
test('backup restore rejects malformed envelopes before any database request',async()=>{
 const {state,route}=await routeHarness('../app/api/projects/workbench/route.ts');state.session.user.id=owner;
 for(const invalid of [null,[],{expectedOwnerId:owner,importId:entity,title:'Study',backup:{}}])assert.equal((await route.PUT(request('/api/projects/workbench','PUT',invalid))).status,400);
 assert.equal(state.calls.length,0);
});

test('connected writing rejects changed numbers and fake citations before issuing a write',async()=>{
 const {state,route}=await routeHarness('../app/api/projects/workbench/route.ts');state.session.user.id=owner;
 const run={...record,collection:'run',payload:{name:'Successful run',specificationId:entity,protocolId:'',status:'success',sourceFingerprint:'a'.repeat(64),dataFingerprint:'b'.repeat(64),settingsHash:'c'.repeat(64),engine:'acaora-stats-v2',sample:true,metrics:[['estimate','0.123456789']],error:'',startedAt:record.created_at,elapsedMs:1,settings:'{}'}};
 const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?`[${v.map(canonical).join(',')}]`:`{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`:JSON.stringify(v);
 const ref={kind:'run',id:entity,label:'Successful run',revision:1,fingerprint:createHash('sha256').update(canonical(run.payload)).digest('hex')};
 const writing={title:'Fixed result',lead:'',conclusion:'',runId:entity,metrics:[{key:'estimate',label:'Estimate',value:'9.99',decimals:3,unit:''}],references:[ref],citations:[],confirmedAt:record.created_at};
 const command={projectId:project,kind:'writing',entityId:'50000000-0000-4000-8000-000000000001',expectedRevision:0,payload:writing,archived:false,expectedOwnerId:owner};
 state.payload={project:{id:project,title:'Study',updated_at:record.created_at,metadata:{}},events:[run]};
 assert.equal((await route.POST(request('/api/projects/workbench','POST',command))).status,400);assert.equal(state.calls.length,1);
 writing.metrics[0].value='0.123456789';writing.citations=['missing-citation'];assert.equal((await route.POST(request('/api/projects/workbench','POST',command))).status,409);assert.equal(state.calls.length,2);
 writing.citations=[];const saved={...record,entity_id:command.entityId,collection:'writing',payload:writing};state.payload=resource=>resource==='rpc/export_research_project'?{project:{id:project,title:'Study',updated_at:record.created_at,metadata:{}},events:[run]}:saved;
 assert.equal((await route.POST(request('/api/projects/workbench','POST',command))).status,200);assert.equal(state.calls.at(-1).resource,'rpc/save_research_connected_record');assert.equal(JSON.parse(state.calls.at(-1).init.body).p_expected_sequence,1);
});

test('collaboration route rejects coerced roles and account switches; invite codes are passed only to the restricted RPC',async()=>{
 const {state,route}=await routeHarness('../app/api/projects/collaboration/route.ts');state.session.user.id=owner;
 const command={action:'invite',projectId:project,operationId:entity,code:'a'.repeat(48),role:['editor'],expectedOwnerId:owner};assert.equal((await route.POST(request('/api/projects/collaboration','POST',command))).status,400);assert.equal(state.calls.length,0);
 command.role='editor';command.expectedOwnerId='foreign';assert.equal((await route.POST(request('/api/projects/collaboration','POST',command))).status,409);assert.equal(state.calls.length,0);
 command.expectedOwnerId=owner;state.payload={id:entity,expiresAt:record.created_at};assert.equal((await route.POST(request('/api/projects/collaboration','POST',command))).status,200);assert.equal(state.calls[0].resource,'rpc/research_collaboration');assert.equal(JSON.parse(state.calls[0].init.body).p_code,command.code);
});
