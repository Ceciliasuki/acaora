import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const cache = new Map();
async function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const source = await readFile(url, 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const dependencies = new Map();
  for (const match of compiled.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
    const path = match[2]; if (!path.startsWith('.')) throw new Error(`Unexpected dependency ${path}`);
    dependencies.set(path, await load(new URL(`${path}.ts`, url)));
  }
  const loadedModule = {exports: {}};
  new Function('require', 'module', 'exports', compiled)(name => dependencies.get(name), loadedModule, loadedModule.exports);
  cache.set(url.href, loadedModule.exports); return loadedModule.exports;
}
const {emptyResearchDossier, validateResearchDossier, validateProjectAnalysis, validateProjectAnalyses, missingFindingSources, buildResearchExport} = await load(new URL('../app/lib/project-research.ts', import.meta.url));
const {readResearchDraft, writeResearchDraft} = await load(new URL('../app/projects/research-drafts.ts', import.meta.url));
const {serializeProjectAnalysisSettings} = await load(new URL('../app/data/project-analysis-settings.ts', import.meta.url));
const now = '2026-10-24T10:00:00.000Z';
const record = () => ({id: 'analysis-one', snapshotId: 'snapshot-one', name: 'Main model', role: 'primary', sample: false, method: 'OLS', context: 'Y ~ X', settings: '{"outcome":"Y","predictors":["X"]}', dataset: {name: 'data.csv', rows: 80, fingerprint: 'a'.repeat(64), sourceFingerprint: 'b'.repeat(64)}, metrics: [['coefficient', '0.23']], interpretation: 'Needs verification.', evidenceIds: ['evidence-one'], createdAt: now, registeredAt: now});
const finding = () => ({id: 'finding-one', statement: 'A conditional association needs checking.', assessment: 'supported', limitations: 'Unmeasured confounding.', evidenceIds: ['evidence-one'], analysisIds: ['analysis-one'], withdrawn: false});

test('saved research judgements require stated sources while incomplete local drafts remain recoverable', () => {
  const dossier = emptyResearchDossier(); dossier.findings.push(finding());
  assert.equal(validateResearchDossier(dossier), true);
  dossier.findings[0].evidenceIds = []; dossier.findings[0].analysisIds = [];
  assert.equal(validateResearchDossier(dossier), false); assert.equal(validateResearchDossier(dossier, true), true);
  dossier.findings[0].assessment = 'unreviewed'; assert.equal(validateResearchDossier(dossier), true);
  for (const patch of [{assessment: ['unreviewed']}, {id: 'bad\nidentifier'}, {statement: 'x'.repeat(2001)}, {unverifiedField: true}]) {
    const next = emptyResearchDossier(); next.findings.push({...finding(), ...patch}); assert.equal(validateResearchDossier(next), false);
  }
});

test('analysis registration rejects rows, arbitrary fields, missing data identity and duplicated snapshots', () => {
  assert.equal(validateProjectAnalysis(record()), true);
  for (const patch of [{role: ['primary']}, {dataset: {...record().dataset, rows: -1}}, {dataset: {...record().dataset, fingerprint: 'unknown'}}, {sourceRows: [[1, 2]]}, {metrics: Array(81).fill(['estimate', '1'])}]) assert.equal(validateProjectAnalysis({...record(), ...patch}), false);
  assert.equal(validateProjectAnalyses([record(), {...record(), id: 'different-id'}]), false);
  assert.equal(validateProjectAnalyses(Array(31).fill(record())), false);
});

test('imported snapshot settings cannot smuggle source rows into cloud project metadata', () => {
  const basic = {kind:'basic',config:{method:'describe',x:'sleep',y:'score',group:'group',value:'score'}};
  assert.equal(JSON.parse(serializeProjectAnalysisSettings(basic)).x, 'sleep');
  assert.throws(() => serializeProjectAnalysisSettings({...basic,config:{...basic.config,sourceRows:[['private-row']]}}), /未知字段/);
  assert.throws(() => serializeProjectAnalysisSettings({kind:'ols',config:{outcome:'y',predictors:['x'],standardErrors:'HC3',rows:[['private-row']]}}), /未知字段/);
  assert.equal(JSON.parse(serializeProjectAnalysisSettings({kind:'ols',config:{outcome:'y',predictors:['x'],standardErrors:'HC3'}})).standardErrors, 'HC3');
});

test('research exports retain evidence, method settings and missing-source warnings without claiming full reproduction', () => {
  const dossier = emptyResearchDossier(); dossier.protocol.question = 'Can this association be supported?'; dossier.findings.push(finding());
  const evidence = {id: 'evidence-one', paperId: 'paper-one', paragraphId: 'paragraph-one', paperTitle: 'Source title', fileName: 'source.pdf', page: 2, section: 'Methods', quote: '<script>Original source, never executed.</script>', comment: 'An independent comment.', createdAt: 1};
  const project = {id: 'project-one', title: 'Study dossier', updated_at: now, metadata: {notes: 'Existing notes.', tasks: [{text: 'Check units', done: false}], research: dossier, analysisRecords: [record()], evidence: [evidence]}};
  const exported = buildResearchExport(project), json = JSON.parse(exported.json);
  assert.match(exported.markdown, /不构成预注册/); assert.match(exported.markdown, /&lt;script&gt;/); assert.doesNotMatch(exported.markdown, /<script>/);
  assert.match(exported.markdown, /coefficient \| 0.23/); assert.match(exported.markdown, /paragraph=paragraph-one&project=project-one/);
  assert.deepEqual(json.project.analyses[0], record()); assert.equal(json.boundaries.sourceRowsIncluded, false); assert.equal(json.boundaries.platformVerified, false);
  project.metadata.evidence = [];
  assert.deepEqual(missingFindingSources(finding(), [], [record()]), ['evidence-one']);
  assert.match(buildResearchExport(project).markdown, /论文摘录关联已失效：evidence-one/);
  project.metadata.research = {version: 99}; assert.throws(() => buildResearchExport(project), /不受支持/);
});

test('research drafts use account-scoped storage and compare-and-swap before replacing or clearing another tab', () => {
  const values = new Map(), previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}});
  try {
    const value = {version: 1, ownerId: 'owner-a', projectId: 'project-one', baseline: JSON.stringify(emptyResearchDossier()), value: emptyResearchDossier()};
    value.value.protocol.question = 'A private draft';
    const saved = writeResearchDraft('owner-a', 'project-one', value, null); assert.equal(saved.ok, true);
    assert.equal(readResearchDraft('owner-a', 'project-one').draft.value.protocol.question, 'A private draft');
    assert.equal(readResearchDraft('owner-b', 'project-one').draft, null);
    assert.equal(writeResearchDraft('owner-a', 'project-one', null, null).ok, false);
    assert.equal(writeResearchDraft('owner-b', 'project-one', value, null).ok, false);
    const large = emptyResearchDossier();
    for (const name of Object.keys(large.protocol)) large.protocol[name] = 'q'.repeat(2000);
    large.findings = Array.from({length:20},(_,index)=>({...finding(),id:`finding-${index}`,statement:'s'.repeat(2000),limitations:'l'.repeat(2000)}));
    const largeDraft = {...value,projectId:'large-project',baseline:JSON.stringify(large),value:large};
    const largeSaved = writeResearchDraft('owner-a','large-project',largeDraft,null);
    assert.equal(largeSaved.ok,true); assert.ok(largeSaved.raw.length>120_000);
    assert.equal(readResearchDraft('owner-a','large-project').draft.value.findings.length,20);
    values.set('acaora.research-draft.v1:owner-a:project-one', '{damaged raw draft');
    assert.equal(writeResearchDraft('owner-a', 'project-one', null, saved.raw).ok, false);
    const damaged = readResearchDraft('owner-a', 'project-one'); assert.ok(damaged.error); assert.equal(damaged.raw, '{damaged raw draft');
  } finally {if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;}
});
