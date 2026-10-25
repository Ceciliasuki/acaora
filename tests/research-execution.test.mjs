import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const cache = new Map();
async function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  let code = ts.transpileModule(await readFile(url, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
  for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
    const specifier = match[1];
    const target = specifier.startsWith('.') ? (await load(new URL(`${specifier}.ts`, url))).url : import.meta.resolve(specifier);
    code = code.replace(match[0], `from '${target}'`);
  }
  const encoded = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  const loaded = {url: encoded, exports: await import(encoded)}; cache.set(url.href, loaded); return loaded;
}
const {executeResearchAnalysis: execute} = (await load(new URL('../app/data/research-execution.ts', import.meta.url))).exports;
const data = {name: 'controlled.csv', headers: ['x', 'y', 'group'], rows: [['1', '2.13', 'B'], ['2', '4.08', 'A'], ['3', '5.99', 'B'], ['4', '8.16', 'A'], ['5', '10.05', 'B'], ['6', '12.02', 'A'], ['7', '14.11', 'B'], ['8', '15.95', 'A']]};
const basic = method => ({kind: 'basic', config: {method, x: 'x', y: 'y', group: 'group', value: 'y'}});
const values = result => Object.fromEntries(result.metrics);
const close = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance * (1 + Math.abs(expected)), `${actual} != ${expected}`);

test('basic execution retains full precision and exact group identities without exposing paired rows', () => {
  const before = structuredClone(data);
  const summary = execute(data, {...basic('describe'), config: {...basic('describe').config, x: 'y'}});
  assert.equal(summary.engine, 'acaora-stats-v2'); close(values(summary).mean, 9.06125);
  assert.notEqual(values(summary).mean, Number(values(summary).mean.toFixed(2)));
  const relation = execute(data, basic('relation'));
  // Σxy=409.64, ΣxΣy/n=326.205 and Σ(x-x̄)^2=42.
  close(values(relation).slope, 83.435 / 42); assert.equal(values(relation).n, 8);
  const welch = execute(data, basic('test'));
  assert.equal(values(welch)['group:B:n'], 4); assert.equal(values(welch)['group:A:n'], 4);
  assert.ok(values(welch).t < 0); assert.ok(values(welch).p > 0 && values(welch).p < 1);
  assert.deepEqual(relation.tables, []); assert.equal(Object.hasOwn(relation, 'pairs'), false);
  assert.deepEqual(data, before);
});

test('OLS execution reproduces independent reference estimates and excludes individual diagnostics', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/multiple-regression-reference.json', import.meta.url), 'utf8'));
  const item = fixture.cases[0], config = {outcome: 'y', predictors: item.data.headers.filter(name => name !== 'y'), standardErrors: 'HC3'};
  const result = execute(item.data, {kind: 'ols', config}), metrics = values(result), expected = item.expected;
  assert.equal(result.engine, 'acaora-ols-v2'); assert.equal(metrics.n, expected.n); close(metrics.r2, expected.r2, 2e-8);
  const names = ['截距', ...config.predictors];
  expected.methods.HC3.forEach((coefficient, index) => {
    for (const key of ['estimate', 'se', 't', 'p', 'low', 'high', 'vif']) {
      const actual = metrics[`coef:${names[index]}:${key}`];
      if (coefficient[key] === null) assert.equal(actual, null); else close(actual, coefficient[key], 2e-8);
    }
  });
  assert.equal(result.tables.length, 1); assert.equal(result.charts[0].kind, 'forest');
  assert.equal(Object.hasOwn(result, 'observations'), false);
  assert.ok(!JSON.stringify(result.tables).includes('Cook'));
});

test('advanced execution preserves seed-determinism and filters observation-level tables before flattening', () => {
  const config = {method: 'paired', outcome: 'y', predictors: [], group: '', second: 'x', components: 1, clusters: 2, folds: 2, seed: 42};
  const paired = execute(data, {kind: 'advanced', config});
  assert.equal(paired.engine, 'acaora-advanced-v4'); assert.equal(values(paired).n, 8);
  assert.deepEqual(paired.tables, []); assert.ok(!paired.metrics.some(([key]) => key.startsWith('table:配对差值:')));
  const bootstrap = {...config, method: 'bootstrap', bootstrapStatistic: 'mean', bootstrapUnit: 'row', bootstrapIterations: 100};
  const first = execute(data, {kind: 'advanced', config: bootstrap}), second = execute(data, {kind: 'advanced', config: bootstrap});
  assert.deepEqual(first, second);
  assert.ok(first.metrics.some(([key]) => key === 'Bootstrap 标准误'));
  assert.ok(first.tables.every(table => !table.observationLevel));
  const posthoc = execute(data, {kind: 'advanced', config: {...config, method: 'posthoc', outcome: 'y', group: 'group', second: '', posthocFamily: 'all'}});
  assert.ok(posthoc.metrics.some(([key]) => key.startsWith('table:')));
});

test('unknown configurations and missing columns fail without mutating data', () => {
  const before = structuredClone(data);
  for (const analysis of [{kind: 'unknown', config: {}}, {...basic('describe'), config: {...basic('describe').config, sourceRows: [['private']]}}, {...basic('describe'), config: {...basic('describe').config, x: 'missing'}}]) assert.throws(() => execute(data, analysis));
  assert.deepEqual(data, before);
});
