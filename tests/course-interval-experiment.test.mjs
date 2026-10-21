import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/courses/interval-experiment-math.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {intervalFromMean, sampleIntervals, MAX_INTERVALS} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('continuing a seeded experiment in batches reproduces one uninterrupted sample', () => {
  const design = {seed: 0xffffffff, n: 25, confidence: 0.95};
  const all = sampleIntervals({...design, count: 37});
  const first = sampleIntervals({...design, count: 12});
  const next = sampleIntervals({...design, seed: first.nextSeed, count: 25});
  assert.deepEqual([...first.intervals, ...next.intervals], all.intervals);
  assert.equal(next.nextSeed, all.nextSeed);
  assert.deepEqual(sampleIntervals({...design, count: 37}), all);
  assert.notDeepEqual(sampleIntervals({...design, seed: 0, count: 37}).intervals, all.intervals);
  assert.ok(all.intervals.every(interval => Number.isFinite(interval.mean) && interval.lower <= interval.mean && interval.mean <= interval.upper));
});

test('known-sigma interval widths match normal critical values and scale with the square root of sample size', () => {
  const small = intervalFromMean(0, 25, 0.95);
  const large = intervalFromMean(0, 100, 0.95);
  assert.ok(Math.abs(small.upper - 1.959963984540054 / 5) < 1e-14);
  assert.ok(Math.abs(large.upper * 2 - small.upper) < 1e-14);
  assert.ok(intervalFromMean(0, 25, 0.99).upper > small.upper);
  assert.ok(intervalFromMean(0, 25, 0.9).upper < small.upper);
  assert.equal(intervalFromMean(0, 25, 0.95).covered, true);
  assert.equal(intervalFromMean(2, 25, 0.95).covered, false);
  const low = sampleIntervals({seed: 47, n: 25, confidence: 0.9, count: 5});
  const high = sampleIntervals({seed: 47, n: 25, confidence: 0.99, count: 5});
  assert.deepEqual(low.intervals.map(item => item.mean), high.intervals.map(item => item.mean));
});

test('experiment rejects unsupported designs, unbounded batches, seeds and nonfinite means', () => {
  const valid = {seed: 0, n: 25, confidence: 0.95, count: 1};
  for (const n of [0, 4, 201, 5.5, NaN, Infinity]) assert.throws(() => sampleIntervals({...valid, n}), RangeError);
  for (const confidence of [0, 0.8, 95, NaN]) assert.throws(() => sampleIntervals({...valid, confidence}), RangeError);
  for (const count of [0, -1, 1.5, MAX_INTERVALS + 1, Infinity]) assert.throws(() => sampleIntervals({...valid, count}), RangeError);
  for (const seed of [-1, 0x100000000, 1.5, NaN]) assert.throws(() => sampleIntervals({...valid, seed}), RangeError);
  for (const mean of [NaN, Infinity, -Infinity]) assert.throws(() => intervalFromMean(mean, 25, 0.95), RangeError);
});
