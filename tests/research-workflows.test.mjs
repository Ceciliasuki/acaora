import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Load actual pure TypeScript helpers and their relative dependencies in memory.
// No emitted files, package changes or alternate implementations are involved.
const modules = new Map();
async function moduleUrl(url) {
  if (modules.has(url.href)) return modules.get(url.href);
  const source = await readFile(url, 'utf8');
  let compiled = url.pathname.endsWith('.mjs') ? source : ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
  for (const match of [...compiled.matchAll(/(?:from\s*|import\s*)(['"])(\.[^'"]+)\1/g)]) {
    const [, quote, specifier] = match;
    const child = new URL(/\.(?:mjs|js|ts)$/.test(specifier) ? specifier : `${specifier}.ts`, url);
    compiled = compiled.replaceAll(`${quote}${specifier}${quote}`, JSON.stringify(await moduleUrl(child)));
  }
  const result = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
  modules.set(url.href, result);
  return result;
}
const load = async path => import(await moduleUrl(new URL(path, import.meta.url)));
const {validateProjectEvidence, paperSourceHref, evidenceDuplicateKey} = await load('../app/lib/project-evidence.ts');
const {exportPaperBackup, parsePaperBackup, restoredPaperCopies} = await load('../app/papers/paper-backup.ts');
const {normalizeBibliography, normalizeDoi, citationText} = await load('../app/papers/paper-bibliography.ts');
const {parseAnalysisRecipe, createAnalysisRecipe, validateRecipeConfig, fingerprintDataset} = await load('../app/data/analysis-recipe.ts');
const {regression, welchTest} = await load('../app/stats.ts');

const metadata = {authors: ['Smith, Jane'], year: 2024, venue: 'Journal of Research', doi: '10.1234/study_a', url: 'https://example.org/study', tags: ['方法'], source: 'manual', confirmed: true};
function paper() {
  return {id: 'source-paper', ownerId: 'old-owner', title: 'An evidence study', fileName: 'study.pdf', addedAt: 1, updatedAt: 2, activeParagraph: 0, bibliography: structuredClone(metadata), paragraphs: [
    {id: 'paragraph-1', page: 7, section: 'Methods', original: 'Exact source 📑 with evidence.', translation: '译文', note: 'Separate personal interpretation.', bookmarked: true, read: false, annotations: [{id: 'annotation-1', start: 0, end: 12, quote: 'Exact source', comment: 'Check the method.', color: 'yellow', createdAt: 3}]},
  ]};
}
const evidence = {id: 'evidence-1', paperId: 'paper & ?/#', paragraphId: 'paragraph?&', paperTitle: 'An evidence study', fileName: 'study.pdf', page: 7, section: 'Methods', quote: 'Exact source', comment: 'Separate interpretation.', createdAt: 3, start: 0, end: 12};

test('project evidence validates source snapshots, prevents arbitrary URL storage and preserves separate comments', () => {
  assert.equal(validateProjectEvidence(evidence), true);
  for (const patch of [{href: 'javascript:alert(1)'}, {page: 0}, {quote: ''}, {comment: 'x'.repeat(5001)}, {paperId: 'bad\nidentifier'}, {end: 999}, {createdAt: NaN}, {start: undefined}]) {
    assert.equal(validateProjectEvidence({...evidence, ...patch}), false);
  }
  const link = new URL(paperSourceHref(evidence), 'https://acaora.cn');
  assert.equal(link.origin, 'https://acaora.cn');
  assert.equal(link.pathname, '/papers');
  assert.equal(link.searchParams.get('paper'), evidence.paperId);
  assert.equal(link.searchParams.get('paragraph'), evidence.paragraphId);
  assert.deepEqual([...link.searchParams.keys()].sort(), ['paper', 'paragraph']);
  assert.equal(evidenceDuplicateKey(evidence), evidenceDuplicateKey({...evidence, id: 'new', comment: 'New comment'}));
  assert.notEqual(evidenceDuplicateKey(evidence), evidenceDuplicateKey({...evidence, paragraphId: 'other'}));
});

test('paper backup whitelists research records and removes credentials, owner IDs, PDF bytes and nested secrets', () => {
  const source = {...paper(), pdfBytes: 'private bytes', apiKey: 'secret', providerSettings: {key: 'secret'}, aiMemory: {paragraph: {}, chats: [{action: 'summary', title: 'Summary', createdAt: 4, data: {finding: 'Retained finding', apiKey: 'nested secret', nested: {access_token: 'token', safe: ['retained']}}}]}};
  const before = structuredClone(source);
  const text = exportPaperBackup([source], 5);
  const envelope = JSON.parse(text);
  assert.equal(envelope.format, 'acaora-paper-backup');
  assert.equal(envelope.version, 1);
  assert.equal(envelope.exportedAt, 5);
  const [restored] = parsePaperBackup(text);
  for (const key of ['ownerId', 'pdfBytes', 'apiKey', 'providerSettings']) assert.equal(Object.hasOwn(restored, key), false);
  assert.deepEqual(restored.aiMemory.chats[0].data, {finding: 'Retained finding', nested: {safe: ['retained']}});
  assert.deepEqual(restored.paragraphs, source.paragraphs);
  assert.deepEqual(restored.bibliography, metadata);
  assert.deepEqual(source, before);
});

test('backups preserve paper favorites, accept legacy records and reject non-boolean flags', () => {
  for (const favorite of [true, false]) {
    const [restored] = parsePaperBackup(exportPaperBackup([{...paper(), favorite}]));
    assert.equal(restored.favorite, favorite);
    assert.deepEqual(restored.paragraphs, paper().paragraphs);
  }
  assert.equal(parsePaperBackup(exportPaperBackup([paper()]))[0].favorite, undefined);
  for (const favorite of [1, 'true', null]) assert.throws(()=>exportPaperBackup([{...paper(), favorite}]));
});

test('backup parsing rejects unsupported versions and any malformed record before returning a recoverable batch', () => {
  const envelope = JSON.parse(exportPaperBackup([paper()], 5));
  for (const version of [0, 2, '1']) assert.throws(() => parsePaperBackup(JSON.stringify({...envelope, version})));
  const malformed = structuredClone(envelope.papers[0]);
  malformed.paragraphs[0].annotations[0].end = 13;
  const input = JSON.stringify({...envelope, papers: [envelope.papers[0], malformed]});
  let accepted;
  assert.throws(() => {accepted = parsePaperBackup(input);});
  assert.equal(accepted, undefined, 'a malformed second paper cannot yield a partial import list');
  assert.throws(() => parsePaperBackup(JSON.stringify({...envelope, papers: [{...paper(), bibliography: {...metadata, year: '2024'}}]})));
});

test('restoration creates new owner-scoped copies without overwriting source IDs or mutating the backup', () => {
  const sources = [paper(), {...paper(), id: 'second-source'}];
  const before = structuredClone(sources);
  let counter = 0;
  const copies = restoredPaperCopies(sources, 'new-owner', 100, () => `restored-${++counter}`);
  assert.deepEqual(copies.map(item => item.id), ['restored-1', 'restored-2']);
  assert.ok(copies.every(item => item.ownerId === 'new-owner' && item.updatedAt === 100));
  assert.deepEqual(copies[0].paragraphs, sources[0].paragraphs);
  assert.deepEqual(sources, before);
  assert.equal(restoredPaperCopies([paper()], null, 101, () => 'guest-copy')[0].ownerId, undefined);
});

test('citation export requires confirmed metadata and escapes BibTeX specials and RIS title record injection', () => {
  assert.throws(() => citationText({...paper(), bibliography: undefined}, 'bib'), /确认/);
  assert.throws(() => citationText({...paper(), bibliography: {...metadata, confirmed: false}}, 'ris'), /确认/);
  const source = {...paper(), title: 'Study {A} & 50%_value #1 $x$ \\ path'};
  const bib = citationText(source, 'bib');
  for (const escaped of ['\\{A\\}', '\\&', '\\%', '\\_', '\\#', '\\$', '\\textbackslash{}']) assert.ok(bib.includes(escaped), escaped);
  const ris = citationText({...paper(), title: 'Study\nER  -\nTY  - FAKE'}, 'ris');
  assert.equal(ris.split('\r\n').filter(line => line.startsWith('TY  -')).length, 1);
  assert.equal(ris.split('\r\n').filter(line => line === 'ER  -').length, 1);
  assert.equal(normalizeDoi('https://doi.org/10.1234/STUDY_A'), '10.1234/study_a');
  for (const patch of [{year: '2024'}, {year: 2101}, {url: 'javascript:alert(1)'}, {url: 'https://user:password@example.org'}, {authors: ['Bad\nAuthor']}, {doi: 'not-a-doi'}, {confirmed: 'true'}]) assert.equal(normalizeBibliography({...metadata, ...patch}), undefined);
});

test('regression removes missing pairs rather than treating blank numeric cells as zero', () => {
  const data = {name: 'pairs.csv', headers: ['x', 'y'], rows: [['1', '3'], ['2', '5'], ['3', '7'], ['', '100'], ['100', ' '], ['NA', '2'], ['4', 'NaN']]};
  const result = regression(data, 'x', 'y');
  assert.deepEqual(result.pairs, [[1, 3], [2, 5], [3, 7]]);
  assert.equal(result.n, 3);
  assert.equal(result.slope, 2);
  assert.equal(result.intercept, 1);
});

test('Welch rejects a third observed group and excludes blank outcome cells from each sample', () => {
  const data = {name: 'groups.csv', headers: ['group', 'value'], rows: [['A', '1'], ['A', '3'], ['A', ''], ['B', '2'], ['B', '6'], ['B', 'NaN'], ['', '999']]};
  const result = welchTest(data, 'group', 'value');
  assert.deepEqual(result.samples, [[1, 3], [2, 6]]);
  assert.equal(welchTest({...data, rows: [...data.rows, ['C', '5']]}, 'group', 'value'), null);
});

test('analysis recipes preserve an explicit versioned method without rows and reject unsupported settings', async () => {
  const data = {name: 'private.csv', headers: ['x', 'y'], rows: [['1', '3'], ['2', '5'], ['3', '7']]};
  const fingerprint = await fingerprintDataset(data);
  const config = {method: 'relation', x: 'x', y: 'y', group: '', value: ''};
  const recipe = createAnalysisRecipe(data, config, fingerprint, '2026-10-21T00:00:00Z');
  assert.match(fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(recipe.dataset.rows, 3);
  assert.equal(Object.hasOwn(recipe, 'rows'), false);
  assert.deepEqual(parseAnalysisRecipe(JSON.stringify(recipe)), recipe);
  assert.deepEqual(validateRecipeConfig(data, config), []);
  assert.ok(validateRecipeConfig(data, {...config, x: 'missing'}).length > 0);
  assert.ok(validateRecipeConfig(data, {...config, y: 'x'}).length > 0);
  for (const patch of [{version: 2}, {missingPolicy: 'fill-with-zero'}, {engine: 'arbitrary-code'}, {rows: data.rows}, {settings: {...recipe.settings, alpha: 0.1}}]) assert.throws(() => parseAnalysisRecipe(JSON.stringify({...recipe, ...patch})));
  assert.notEqual(await fingerprintDataset({...data, rows: [...data.rows, ['4', '9']]}), fingerprint);
});
