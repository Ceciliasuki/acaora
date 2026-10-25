import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const cache = new Map();
async function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  let code = ts.transpileModule(await readFile(url, 'utf8'), {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
  for (const match of [...code.matchAll(/from\s+['"]([^'"]+)['"]/g)]) {
    const specifier = match[1], target = specifier.startsWith('.') ? (await load(new URL(`${specifier}.ts`, url))).url : import.meta.resolve(specifier);
    code = code.replace(match[0], `from '${target}'`);
  }
  const encoded = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`, loaded = {url: encoded, exports: await import(encoded)};
  cache.set(url.href, loaded); return loaded;
}
const {previewResearchJoin: join, validateJoinPlan, createJoinReceipt} = (await load(new URL('../app/data/research-joins.ts', import.meta.url))).exports;
const plan = {leftKeys: ['id'], rightKeys: ['code'], how: 'left', relationship: 'many-to-one', rightPrefix: 'r_', missingKeys: 'reject'};
const left = {name: 'panel.csv', headers: ['id', 'year', 'outcome'], rows: [['A', '2023', '1'], ['A', '2024', '2'], ['B', '2024', '3'], ['C', '2024', '4']]};
const right = {name: 'firms.csv', headers: ['code', 'sector'], rows: [['B', 'beta'], ['A', 'alpha'], ['D', 'delta']]};

test('many-to-one left/inner/full joins preserve exact row order, separate keys and auditable input counts', () => {
  const before = structuredClone({left, right}), result = join(left, right, plan);
  assert.deepEqual(result.data.headers, ['id', 'year', 'outcome', 'r_code', 'r_sector']);
  assert.deepEqual(result.data.rows, [['A', '2023', '1', 'A', 'alpha'], ['A', '2024', '2', 'A', 'alpha'], ['B', '2024', '3', 'B', 'beta'], ['C', '2024', '4', '', '']]);
  assert.deepEqual(result.sourceRows, [1, 2, 3, 4]);
  assert.equal(result.audit.leftDuplicateKeys, 1); assert.equal(result.audit.rightDuplicateKeys, 0); assert.equal(result.audit.matchedLeft, 3); assert.equal(result.audit.unmatchedLeft, 1); assert.equal(result.audit.unmatchedRight, 1); assert.equal(result.audit.outputRows, 4);
  assert.deepEqual(join(left, right, {...plan, how: 'inner'}).sourceRows, [1, 2, 3]);
  const full = join(left, right, {...plan, how: 'full'});
  assert.deepEqual(full.data.rows.at(-1), ['', '', '', 'D', 'delta']); assert.deepEqual(full.sourceRows, [1, 2, 3, 4, 0]); assert.equal(full.audit.outputRows, 5);
  assert.deepEqual({left, right}, before);
});

test('one-to-many expands in original right order; cardinality violations never silently create many-to-many samples', () => {
  const uniqueLeft = {name: 'unique', headers: ['id'], rows: [['A'], ['B']]}, repeatedRight = {name: 'repeated', headers: ['code', 'v'], rows: [['A', 'first'], ['B', 'middle'], ['A', 'last']]};
  const result = join(uniqueLeft, repeatedRight, {...plan, relationship: 'one-to-many'});
  assert.deepEqual(result.data.rows, [['A', 'A', 'first'], ['A', 'A', 'last'], ['B', 'B', 'middle']]); assert.deepEqual(result.sourceRows, [1, 1, 2]); assert.equal(result.audit.matchedLeft, 2); assert.equal(result.audit.rightDuplicateKeys, 1);
  assert.throws(() => join(left, repeatedRight, plan), /右表 1 个重复键组/);
  assert.throws(() => join(left, repeatedRight, {...plan, relationship: 'one-to-many'}), /左表键唯一/);
  assert.throws(() => join(left, right, {...plan, relationship: 'one-to-one'}), /两表键唯一/);
  assert.equal(validateJoinPlan({...plan, relationship: 'many-to-many'}), false);
});

test('missing keys are rejected or remain independently unmatched; valid values are never trimmed or coerced', () => {
  const l = {name: 'l', headers: ['id'], rows: [[''], ['NA'], [' A'], ['A'], ['01'], ['1'], ['a']]}, r = {name: 'r', headers: ['code'], rows: [[''], ['null'], ['A'], ['1']]};
  assert.throws(() => join(l, r, plan), /左表 2 行，右表 2 行/);
  const result = join(l, r, {...plan, how: 'full', missingKeys: 'unmatched'});
  assert.equal(result.audit.matchedLeft, 2); assert.equal(result.audit.unmatchedLeft, 5); assert.equal(result.audit.unmatchedRight, 2); assert.equal(result.audit.outputRows, 9); assert.equal(result.audit.leftDuplicateKeys, 0);
  assert.deepEqual(result.sourceRows, [1, 2, 3, 4, 5, 6, 7, 0, 0]); assert.deepEqual(result.data.rows[2], [' A', '']); assert.deepEqual(result.data.rows[4], ['01', '']);
});

test('compound keys are tuple-safe and prototype-like values do not collide', () => {
  const l = {name: 'l', headers: ['id', 'period'], rows: [['a|b', 'c'], ['a', 'b|c'], ['__proto__', '2024'], ['constructor', '2024']]}, r = {name: 'r', headers: ['code', 'year', 'v'], rows: [['a', 'b|c', 'second'], ['__proto__', '2024', 'safe'], ['a|b', 'c', 'first'], ['constructor', '2024', 'also-safe']]};
  const result = join(l, r, {...plan, leftKeys: ['id', 'period'], rightKeys: ['code', 'year'], relationship: 'one-to-one'});
  assert.deepEqual(result.data.rows.map(row => row.at(-1)), ['first', 'second', 'safe', 'also-safe']); assert.equal(result.audit.matchedLeft, 4);
});

test('strict plans, schemas, prefix collisions and oversized predicted allocations are refused', () => {
  for (const invalid of [null, {...plan, unknown: true}, {...plan, leftKeys: []}, {...plan, rightKeys: ['code', 'code']}, {...plan, leftKeys: ['id', 'year']}, {...plan, rightPrefix: ' '}, {...plan, how: ['left']}]) assert.equal(validateJoinPlan(invalid), false);
  assert.throws(() => join(left, right, {...plan, leftKeys: ['not-there']}), /合并键不存在/);
  assert.throws(() => join({...left, headers: ['id', 'id', 'outcome']}, right, plan), /列名重复/);
  assert.throws(() => join({...left, rows: [['A']]}, right, plan), /不完整行/);
  assert.throws(() => join({name: 'sparse', headers: ['id'], rows: [Array(1)]}, right, plan), /不完整行/);
  assert.throws(() => join({name: 'sparse', headers: Object.assign(Array(2), {1: 'id'}), rows: []}, right, plan), /格式无效/);
  assert.equal(validateJoinPlan({...plan, leftKeys: Object.assign(Array(3), {0: 'id', 2: 'year'}), rightKeys: ['code', 'sector', 'third']}), false);
  assert.throws(() => join({name: 'l', headers: ['id', 'r_code'], rows: [['A', 'collision']]}, right, plan), /列名冲突/);
  const emptyWide = {name: 'wide', headers: Array.from({length: 1999}, (_, i) => `c${i}`), rows: []};
  assert.throws(() => join(emptyWide, right, {...plan, leftKeys: ['c0']}), /超过 2,000 列/);
  const l = {name: 'l', headers: ['id'], rows: Array.from({length: 60000}, (_, i) => [String(i)])}, r = {name: 'r', headers: ['code'], rows: Array.from({length: 60000}, (_, i) => [String(i + 60000)])};
  assert.throws(() => join(l, r, {...plan, relationship: 'one-to-one', how: 'full'}), /预计全连接结果超过 100,000 行/);
  const bigLeft = {name: 'l', headers: ['id'], rows: Array.from({length: 50001}, (_, i) => [String(i)])}, bigRight = {name: 'r', headers: Array.from({length: 100}, (_, i) => i === 0 ? 'code' : `v${i}`), rows: []};
  assert.throws(() => join(bigLeft, bigRight, plan), /尚未分配输出表/);
});

test('receipt binds both inputs, plan, audit and output without uploading rows; stale previews are rejected', async () => {
  const result = join(left, right, plan), receipt = await createJoinReceipt(left, right, plan, result);
  assert.equal(receipt.format, 'acaora-join-receipt'); assert.equal(receipt.output.rows, result.data.rows.length); assert.equal(receipt.left.rows, 4); assert.equal(receipt.right.rows, 3);
  for (const identity of [receipt.left, receipt.right, receipt.output]) {assert.match(identity.fingerprint, /^[a-f0-9]{64}$/); assert.equal(Array.isArray(identity.rows), false);}
  assert.notEqual(receipt.left.fingerprint, receipt.right.fingerprint); assert.deepEqual(receipt.audit, result.audit); assert.deepEqual(receipt.plan, plan);
  assert.equal(JSON.stringify(receipt).includes('alpha'), false); assert.equal(Object.hasOwn(receipt, 'sourceRows'), false);
  const changed = structuredClone(result); changed.data.rows[0][4] = 'wrong'; await assert.rejects(() => createJoinReceipt(left, right, plan, changed), /输出与当前设置不符/);
  changed.data = result.data; changed.audit.outputRows = 99; await assert.rejects(() => createJoinReceipt(left, right, plan, changed), /预览已变化/);
});
