import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Exercise the actual route handlers and validation helpers in memory. Only
// Next's response adapter and the authenticated REST boundary are replaced;
// no production services, credentials, database or network are involved.
async function routeHarness(path) {
  const state = {
    session: {accessToken: 'isolated-test-token', user: {id: 'isolated-test-owner'}},
    calls: [],
    payload: [],
    status: 200,
    sdkError: null,
    sdkCalls: [],
  };
  const json = (value, init = {}) => new Response(JSON.stringify(value), {
    ...init, headers: {'Content-Type': 'application/json', ...init.headers},
  });
  const shared = {
    readRequestSession: async () => state.session,
    supabaseRest: async (resource, accessToken, init = {}) => {
      state.calls.push({resource, accessToken, init: structuredClone(init)});
      return json(state.payload, {status: state.status});
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
        dependencies.set(specifier, dependency.pathname.endsWith('/api/auth/_shared.ts') ? shared : dependency.pathname.endsWith('/lib/supabase/server.ts') ? {createSupabaseServerClient:async()=>({auth:{getClaims:async()=>({data:{claims:state.session?{sub:state.session.user.id}:null}}),updateUser:async body=>{state.sdkCalls.push(['password',body]);return {error:state.sdkError};},signOut:async options=>{state.sdkCalls.push(['logout',options]);return {error:state.sdkError};}}})} : await load(dependency));
      } else {
        throw new Error(`Unexpected route dependency: ${specifier}`);
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


test('profile PUT rejects stale or missing account identity before any write',async()=>{
 const {state,route}=await routeHarness('../app/api/profile/route.ts');
 for(const expectedOwnerId of [undefined,'previous-owner']){const response=await route.PUT(request('/api/profile','PUT',{display_name:'Old form',expectedOwnerId}));assert.equal(response.status,409);assert.equal(state.calls.length,0);assert.match(response.headers.get('cache-control'),/private, no-store/);}
 state.session=null;assert.equal((await route.PUT(request('/api/profile','PUT',{}))).status,401);assert.equal(state.calls.length,0);
});
test('profile PUT writes only the authenticated identity, without persisting the guard',async()=>{
 const {state,route}=await routeHarness('../app/api/profile/route.ts');const response=await route.PUT(request('/api/profile','PUT',{expectedOwnerId:state.session.user.id,id:'injected-owner',display_name:'New name',preferences:{}}));assert.equal(response.status,200);assert.equal(state.calls.length,1);const written=JSON.parse(state.calls[0].init.body);assert.equal(written.id,state.session.user.id);assert.equal(written.display_name,'New name');assert.equal('expectedOwnerId' in written,false);
});
test('password update rejects old account forms and unauthenticated requests without invoking updateUser',async()=>{
 const {state,route}=await routeHarness('../app/api/auth/password/route.ts');for(const expectedOwnerId of [undefined,'previous-owner'])assert.equal((await route.PUT(request('/api/auth/password','PUT',{password:'ValidPass1',expectedOwnerId}))).status,409);assert.deepEqual(state.sdkCalls,[]);state.session=null;assert.equal((await route.PUT(request('/api/auth/password','PUT',{password:'ValidPass1'}))).status,401);
});
test('password update passes a valid same-account request to the actual route adapter',async()=>{
 const {state,route}=await routeHarness('../app/api/auth/password/route.ts');assert.equal((await route.PUT(request('/api/auth/password','PUT',{password:'ValidPass1',expectedOwnerId:state.session.user.id}))).status,200);assert.deepEqual(state.sdkCalls,[['password',{password:'ValidPass1'}]]);
});
test('logout explicitly limits revocation to the current session',async()=>{
 const {state,route}=await routeHarness('../app/api/auth/logout/route.ts');const response=await route.POST();assert.equal(response.status,200);assert.deepEqual(state.sdkCalls,[['logout',{scope:'local'}]]);assert.deepEqual(await response.json(),{signedOut:true});
});
test('logout service failure never reports a successful sign-out',async()=>{
 const {state,route}=await routeHarness('../app/api/auth/logout/route.ts');state.sdkError={message:'isolated upstream unavailable'};const response=await route.POST();assert.equal(response.status,503);assert.equal((await response.json()).signedOut,undefined);assert.match(response.headers.get('cache-control'),/private, no-store/);
});
