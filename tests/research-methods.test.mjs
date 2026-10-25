import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('../app/lib/research-methods.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {validateCausalGraph, assessCausalGraph, standardNormalCritical, twoGroupPower, requiredSampleSize, minimumDetectableEffect, adjustPValues, TWO_GROUP_POWER_ASSUMPTIONS, P_VALUE_METHOD_NOTES} = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function graph(edges, adjustment = [], extra = []) {const ids = [...new Set(['T', 'Y', ...edges.flat(), ...extra])];return {nodes: ids.map(id => ({id, label: id})), edges: edges.map(([from, to]) => ({from, to})), exposure: 'T', outcome: 'Y', adjustment};}

test('measured confounding is open without its common cause, and blocked after conditioning it', () => {
  const original = graph([['C', 'T'], ['C', 'Y'], ['T', 'Y']]), before = structuredClone(original);
  const unchecked = assessCausalGraph(original); assert.deepEqual(unchecked.openBackdoorPaths, [['T', 'C', 'Y']]); assert.equal(unchecked.adjustmentBlocksMeasuredBackdoors, false);
  const adjusted = assessCausalGraph({...original, adjustment: ['C']}); assert.equal(adjusted.adjustmentBlocksMeasuredBackdoors, true); assert.deepEqual(adjusted.openBackdoorPaths, []);
  assert.match(adjusted.warnings.join(' '), /不证明因果识别/); assert.match(adjusted.warnings.join(' '), /未观测混杂/); assert.deepEqual(original, before);
});

test('conditioning a collider or its descendant opens a backdoor that is naturally closed', () => {
  const edges = [['A', 'T'], ['A', 'C'], ['B', 'C'], ['B', 'Y'], ['C', 'D'], ['T', 'Y']];
  const closed = assessCausalGraph(graph(edges)); assert.deepEqual(closed.backdoorPaths, [['T', 'A', 'C', 'B', 'Y']]); assert.deepEqual(closed.openBackdoorPaths, []);
  assert.equal(assessCausalGraph(graph(edges, ['C'])).openBackdoorPaths.length, 1);
  assert.equal(assessCausalGraph(graph(edges, ['D'])).openBackdoorPaths.length, 1);
  assert.equal(assessCausalGraph(graph(edges, ['D', 'A'])).openBackdoorPaths.length, 0);
});

test('post-treatment adjustment and absence of drawn confounding never become claims of causal validity', () => {
  const result = assessCausalGraph(graph([['T', 'M'], ['M', 'Y']], ['M']));
  assert.equal(result.adjustmentBlocksMeasuredBackdoors, true); assert.match(result.warnings.join(' '), /处理变量的后代/); assert.match(result.warnings.join(' '), /未画出的混杂/);
  // Edges leaving T do not turn a mediating path into a backdoor.
  assert.deepEqual(result.backdoorPaths, []);
});

test('strict DAG validation rejects cycles, unknown fields, repeated ids and invalid adjustment sets', () => {
  const valid = graph([['C', 'T'], ['C', 'Y']]); assert.equal(validateCausalGraph(valid), true);
  const invalid = [null, {...valid, extra: true}, {...valid, nodes: [...valid.nodes, valid.nodes[0]]}, {...valid, edges: [...valid.edges, valid.edges[0]]}, {...valid, adjustment: ['T']}, {...valid, adjustment: ['C', 'C']}, {...valid, edges: [...valid.edges, {from: 'T', to: 'C'}]}, {...valid, edges: [{from: 'unknown', to: 'Y'}]}, {...valid, nodes: valid.nodes.map(node => node.id === 'C' ? {...node, observed: false} : node)}];
  for (const value of invalid) {assert.equal(validateCausalGraph(value), false); assert.throws(() => assessCausalGraph(value));}
});

test('dense DAG exploration refuses a partial reassuring conclusion when the bound is exceeded', () => {
  const ids = ['P', ...Array.from({length: 14}, (_, index) => `A${index}`), 'Y'], edges = [['P', 'T']];
  // 16-node complete DAG is exactly the 120-edge limit, plus P -> T.
  // Omit one harmless direct edge to remain within the closed shape cap.
  for (let first = 0; first < ids.length; first++) for (let second = first + 1; second < ids.length; second++) if (!(first === 0 && second === ids.length - 1)) edges.push([ids[first], ids[second]]);
  const value = graph(edges); assert.equal(validateCausalGraph(value), true); assert.throws(() => assessCausalGraph(value), /10,000/);
});

test('normal critical values and power match independently computed standard-normal references', () => {
  // References use Python stdlib statistics.NormalDist, not the implementation.
  close(standardNormalCritical(.1), 1.6448536269514715); close(standardNormalCritical(.05), 1.9599639845400536); close(standardNormalCritical(.01), 2.5758293035489);
  close(twoGroupPower(.5, .05, 2), .07909753416059662); close(twoGroupPower(.5, .05, 32), .516005273976175); close(twoGroupPower(.5, .05, 64), .8074304194325572); close(twoGroupPower(.5, .05, 100), .9424375431875085);
  close(twoGroupPower(0, .05, 64), .05); close(twoGroupPower(-.5, .05, 64), twoGroupPower(.5, .05, 64));
  assert.match(TWO_GROUP_POWER_ASSUMPTIONS.method, /正态近似/); assert.match(TWO_GROUP_POWER_ASSUMPTIONS.limitations, /非中心 t/);
});

test('sample-size and MDE solvers are monotone and retain the per-group integer boundary', () => {
  assert.equal(requiredSampleSize(.5, .05, .8), 63); assert.ok(twoGroupPower(.5, .05, 62) < .8); assert.ok(twoGroupPower(.5, .05, 63) >= .8);
  assert.equal(requiredSampleSize(100, .05, .8), 2);
  const effect = minimumDetectableEffect(64, .05, .8); close(twoGroupPower(effect, .05, 64), .8);
  assert.ok(effect < .5); assert.ok(minimumDetectableEffect(128, .05, .8) < effect); assert.ok(requiredSampleSize(.3, .05, .8) > requiredSampleSize(.5, .05, .8)); assert.ok(requiredSampleSize(.5, .01, .8) > requiredSampleSize(.5, .05, .8));
  close(twoGroupPower(0, 1e-12, 64), 1e-12, 1e-24);
});

test('infeasible and nonfinite designs fail explicitly instead of returning misleading sample counts', () => {
  for (const call of [() => requiredSampleSize(0, .05, .8), () => requiredSampleSize(1e-9, .05, .8), () => requiredSampleSize(.5, .05, 1), () => requiredSampleSize(.5, .05, .04), () => twoGroupPower(.5, 0, 20), () => twoGroupPower(.5, 1e-20, 20), () => twoGroupPower(NaN, .05, 20), () => twoGroupPower(.5, .05, 1), () => twoGroupPower(.5, .05, 2.5), () => minimumDetectableEffect(1e8, .05, .8)]) assert.throws(call);
});

test('Holm, BH and Bonferroni retain the complete original family, order, ties and zero p values', () => {
  const family = [{id: 'third', p: .04}, {id: 'first', p: .01}, {id: 'fourth', p: .2}, {id: 'second', p: .03}], before = structuredClone(family);
  assert.deepEqual(adjustPValues(family, 'holm').map(row => row.adjusted), [.09, .04, .2, .09]);
  const bh = adjustPValues(family, 'bh'); for (const [index, expected] of [.05333333333333334, .04, .2, .05333333333333334].entries()) close(bh[index].adjusted, expected);
  assert.deepEqual(adjustPValues(family, 'bonferroni').map(row => row.adjusted), [.16, .04, .8, .12]);
  assert.deepEqual(bh.map(({id, p}) => ({id, p})), family); assert.deepEqual(family, before);
  const tied = [{id: 'zero', p: 0}, {id: 'a', p: .01}, {id: 'b', p: .01}, {id: 'one', p: 1}];
  for (const method of ['holm', 'bh', 'bonferroni']) {const result = adjustPValues(tied, method); assert.equal(result[0].adjusted, 0); assert.equal(result[1].adjusted, result[2].adjusted); assert.equal(result[3].adjusted, 1);}
  assert.match(P_VALUE_METHOD_NOTES.bh, /任意依赖结构下不保证/);
});

test('multiple-testing input does not silently drop missing or invalid results', () => {
  const valid = [{id: 'one', p: .01}];
  for (const value of [[], [{id: 'one', p: null}], [{id: 'one', p: NaN}], [{id: 'one', p: -.1}], [{id: 'one', p: 1.1}], [...valid, ...valid], [{id: 'one', p: .01, selected: true}]]) assert.throws(() => adjustPValues(value, 'holm'));
  assert.throws(() => adjustPValues(valid, 'unknown')); assert.deepEqual(adjustPValues(valid, 'bh'), [{id: 'one', p: .01, adjusted: .01}]);
});
