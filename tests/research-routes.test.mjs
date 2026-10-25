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
        dependencies.set(specifier, dependency.pathname.endsWith('/api/auth/_shared.ts') ? shared : await load(dependency));
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

const bibliography = {
  authors: [' Researcher, Jane '], year: 2024, venue: ' Research Journal ',
  doi: 'https://doi.org/10.1234/STUDY_A', url: 'https://example.org/study',
  tags: [' methods ', 'methods'], source: 'Crossref', confirmed: true,
};
const normalizedBibliography = {...bibliography, authors: ['Researcher, Jane'], venue: 'Research Journal', doi: '10.1234/study_a', tags: ['methods']};
const paragraphs = [{id: 'paragraph-1', page: 3, section: 'Methods', original: 'An exact source quotation.', translation: '原文译文', note: 'Personal comment stays separate.', bookmarked: true, read: false,
  annotations: [{id: 'annotation-1', start: 0, end: 8, quote: 'An exact', comment: 'Check source.', color: 'yellow', createdAt: 3}]}];
const paper = () => ({id: 'paper-1', title: 'A source study', fileName: 'source.pdf', addedAt: 1, updatedAt: 1723766400000,
  activeParagraph: 0, paragraphs: structuredClone(paragraphs), bibliography: structuredClone(bibliography), aiMemory: {paragraph: {}, chats: []}});

test('cloud paper GET normalizes bibliography and preserves paragraph, annotation and legacy records', async () => {
  const {state, route} = await routeHarness('../app/api/cloud/papers/route.ts');
  const row = {id: 'paper-1', title: 'A source study', file_name: 'source.pdf', updated_at: '2024-08-16T00:00:00.000Z', deleted_at: null,
    extracted_content: {addedAt: 1, activeParagraph: 0, paragraphs, bibliography}, ai_memory: {paragraph: {}, chats: []}};
  state.payload = [row, {...row, id: 'legacy-paper', extracted_content: {paragraphs}},
    {...row, id: 'invalid-metadata', extracted_content: {paragraphs, bibliography: {...bibliography, url: 'javascript:alert(1)'}}}];
  const before = structuredClone(state.payload);
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control'), /private.*no-store/);
  const result = await response.json();
  assert.deepEqual(result.papers[0].bibliography, normalizedBibliography);
  for (const item of result.papers) assert.deepEqual(item.paragraphs, paragraphs);
  assert.equal(Object.hasOwn(result.papers[1], 'bibliography'), false);
  assert.equal(Object.hasOwn(result.papers[2], 'bibliography'), false);
  assert.deepEqual(result.papers[0].aiMemory, row.ai_memory);
  assert.deepEqual(state.payload, before, 'normalization must not mutate the received cloud records');
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].accessToken, state.session.accessToken);
});

test('cloud paper PUT stores normalized bibliography under extracted content without altering research paragraphs', async () => {
  const {state, route} = await routeHarness('../app/api/cloud/papers/route.ts');
  state.payload = {status: 'saved'};
  const source = paper();
  const before = structuredClone(source);
  const response = await route.PUT(request('/api/cloud/papers', 'PUT', source));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {synced: true});
  assert.equal(state.calls.length, 1);
  const call = state.calls[0];
  assert.equal(call.resource, 'rpc/sync_paper_memory');
  assert.equal(call.init.method, 'POST');
  const body = JSON.parse(call.init.body);
  assert.deepEqual(body.p_extracted_content, {addedAt: source.addedAt, activeParagraph: source.activeParagraph, paragraphs, bibliography: normalizedBibliography});
  assert.deepEqual(body.p_ai_memory, source.aiMemory);
  assert.equal(body.p_title, source.title);
  assert.deepEqual(source, before);

  const legacy = paper(); delete legacy.bibliography;
  const legacyResponse = await route.PUT(request('/api/cloud/papers', 'PUT', legacy));
  assert.equal(legacyResponse.status, 200);
  const legacyBody = JSON.parse(state.calls[1].init.body);
  assert.equal(Object.hasOwn(legacyBody.p_extracted_content, 'bibliography'), false);
  assert.deepEqual(legacyBody.p_extracted_content.paragraphs, paragraphs);
});

test('paper favorites round-trip through the existing JSON payload and reject invalid flags', async () => {
  const {state, route} = await routeHarness('../app/api/cloud/papers/route.ts');
  for (const favorite of [true, false]) {
    state.payload = {status: 'saved'};
    const source = {...paper(), favorite};
    const response = await route.PUT(request('/api/cloud/papers', 'PUT', source));
    assert.equal(response.status, 200);
    const content = JSON.parse(state.calls.at(-1).init.body).p_extracted_content;
    assert.equal(content.favorite, favorite);
    assert.deepEqual(content.paragraphs, source.paragraphs);
    state.payload = [{id: source.id, title: source.title, extracted_content: content}];
    assert.equal((await (await route.GET()).json()).papers[0].favorite, favorite);
  }
  const writes = state.calls.length;
  for (const favorite of ['true', null, 1, {}]) {
    assert.equal((await route.PUT(request('/api/cloud/papers', 'PUT', {...paper(), favorite}))).status, 400);
  }
  assert.equal(state.calls.length, writes, 'invalid flags must not reach the authenticated storage boundary');
});

test('cloud paper PUT refuses invalid bibliography before any REST write', async () => {
  const {state, route} = await routeHarness('../app/api/cloud/papers/route.ts');
  for (const patch of [{year: '2024'}, {doi: 'not-a-doi'}, {url: 'https://user:password@example.org'}, {authors: ['Injected\nAuthor']}, {confirmed: 'true'}]) {
    const source = paper(); source.bibliography = {...source.bibliography, ...patch};
    const response = await route.PUT(request('/api/cloud/papers', 'PUT', source));
    assert.equal(response.status, 400, JSON.stringify(patch));
    assert.match((await response.json()).error, /文献资料/);
  }
  assert.deepEqual(state.calls, []);
});

const quotation = 'An exact quotation.';
const evidence = {id: 'evidence-1', paperId: 'paper-1', paragraphId: 'paragraph-1', paperTitle: 'A source study', fileName: 'source.pdf', page: 3,
  section: 'Methods', quote: quotation, comment: 'A separate interpretation.', createdAt: 1723766400000, start: 0, end: quotation.length};
const expectedUpdatedAt = '2026-10-21T12:34:56.789+08:00';
function projectPayload() {
  return {title: 'Research project', kind: 'paper', status: 'active', expectedOwnerId: 'isolated-test-owner', expectedUpdatedAt,
    metadata: {notes: 'Existing project notes.', tasks: [{id: 'task-1', title: 'Verify the source', done: false}], evidence: [structuredClone(evidence)]}};
}

test('project PATCH uses an encoded version filter and retains evidence alongside existing notes and tasks', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  const id = 'project &?/#';
  const source = projectPayload();
  const before = structuredClone(source);
  state.payload = [{id, title: source.title, metadata: source.metadata}];
  const response = await route.PATCH(request(`/api/projects?${new URLSearchParams({id})}`, 'PATCH', source));
  assert.equal(response.status, 200);
  assert.equal(state.calls.length, 1);
  const call = state.calls[0];
  assert.equal(call.resource, `learning_projects?id=eq.${encodeURIComponent(id)}&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`);
  assert.equal(call.init.method, 'PATCH');
  assert.equal(call.init.headers.Prefer, 'return=representation');
  const saved = JSON.parse(call.init.body);
  assert.deepEqual(saved.metadata, source.metadata);
  assert.equal(Object.hasOwn(saved, 'expectedOwnerId'), false);
  assert.equal(Object.hasOwn(saved, 'expectedUpdatedAt'), false);
  assert.ok(Number.isFinite(Date.parse(saved.updated_at)));
  assert.deepEqual((await response.json()).project.metadata, source.metadata);
  assert.deepEqual(source, before);
});

test('project PATCH returns conflict when the conditional REST update matches no record', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  state.payload = [];
  const response = await route.PATCH(request('/api/projects?id=project-1', 'PATCH', projectPayload()));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /其他修改|已删除/);
  assert.equal(state.calls.length, 1);
  assert.ok(state.calls[0].resource.includes(`&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`));
});

test('project PATCH rejects a switched owner before issuing any REST call', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  const response = await route.PATCH(request('/api/projects?id=project-1', 'PATCH', {...projectPayload(), expectedOwnerId: 'another-account'}));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /账户已切换/);
  assert.deepEqual(state.calls, []);
});

test('project PATCH refuses malformed source evidence before writing otherwise valid project content', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  for (const malformed of [[{...evidence, href: 'javascript:alert(1)'}], [{...evidence, end: quotation.length + 1}], [null], {quote: quotation}, Array(201).fill(evidence)]) {
    const source = projectPayload(); source.metadata.evidence = malformed;
    const response = await route.PATCH(request('/api/projects?id=project-1', 'PATCH', source));
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /论文来源/);
  }
  assert.deepEqual(state.calls, []);
});

test('project PATCH validates structured research and analysis records before any REST write', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  for (const patch of [{research: {version: 99}}, {analysisRecords: [{sourceRows: [[1, 2]]}]}, {analysisRecords: Array(31).fill({})}]) {
    const source = projectPayload(); Object.assign(source.metadata, patch);
    const response = await route.PATCH(request('/api/projects?id=project-1', 'PATCH', source));
    assert.equal(response.status, 400); assert.match((await response.json()).error, /研究设计|分析登记/);
  }
  assert.deepEqual(state.calls, []);
});

test('project PATCH persists research alongside existing evidence, notes and version checks', async () => {
  const {state, route} = await routeHarness('../app/api/projects/route.ts');
  const source = projectPayload(); source.metadata.research = {version: 1, protocol: {question: 'A research question', hypothesis: '', dataSource: '', strategy: '', sample: '', variables: '', robustness: '', limitations: ''}, findings: [{id: 'claim-1', statement: 'Needs further evidence.', assessment: 'unreviewed', limitations: '', evidenceIds: [], analysisIds: [], withdrawn: false}]};
  source.metadata.analysisRecords = [];
  state.payload = [{id: 'project-1', metadata: source.metadata}];
  const response = await route.PATCH(request('/api/projects?id=project-1', 'PATCH', source));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(state.calls[0].init.body).metadata, source.metadata);
  assert.ok(state.calls[0].resource.includes('updated_at=eq.'));
});
