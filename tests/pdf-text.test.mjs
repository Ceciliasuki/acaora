import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

// Compile the actual pure TypeScript parser with the project's existing compiler.
const source = await readFile(new URL('../app/papers/pdf-text.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {readingOrderLines} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function rows(offset = 0, numeric = false) {
  return Array.from({length: 6}, (_, index) => [
    {text: numeric ? `111111${index} 222222${index} 333333${index} 444444${index} 555555${index}` : `Left paragraph ${index} describes the study population and sample rules.`, x: 40, y: 680 - index * 20, width: 320, size: 10},
    {text: numeric ? `666666${index} 777777${index} 888888${index} 999999${index} 000000${index}` : `Right paragraph ${index} describes the model validation and limitations.`, x: 540, y: 680 - index * 20 - offset, width: 320, size: 10},
  ]).flat();
}

test('offset baselines do not interleave two columns', () => {
  const result = readingOrderLines(rows(1), 1000).map(line => line.text);
  assert.equal(result[5], 'Left paragraph 5 describes the study population and sample rules.');
  assert.equal(result[6], 'Right paragraph 0 describes the model validation and limitations.');
});

test('numeric table cells retain horizontal row associations', () => {
  const result = readingOrderLines(rows(0, true), 1000).map(line => line.text);
  assert.equal(result[0], '1111110 2222220 3333330 4444440 5555550 6666660 7777770 8888880 9999990 0000000');
  assert.equal(result.length, 6);
});

test('full-width text separates column bands in reading order', () => {
  const items = rows().concat({text: 'Full width heading spans both columns', x: 40, y: 630, width: 900, size: 14});
  const result = readingOrderLines(items, 1000).map(line => line.text);
  assert.equal(result[5], 'Right paragraph 2 describes the model validation and limitations.');
  assert.equal(result[6], 'Full width heading spans both columns');
  assert.equal(result[7], 'Left paragraph 3 describes the study population and sample rules.');
});

test('single-column multiline title remains top-to-bottom', () => {
  const result = readingOrderLines([
    {text: 'First title line', x: 40, y: 700, width: 120, size: 18},
    {text: 'Second title line', x: 40, y: 675, width: 125, size: 18},
    {text: 'A normal body paragraph', x: 40, y: 630, width: 200, size: 10},
  ], 1000);
  assert.deepEqual(result.map(line => line.text), ['First title line', 'Second title line', 'A normal body paragraph']);
});

test('fragmented full-width headings stay together between column bands', () => {
  const result = readingOrderLines(rows().concat([
    {text: 'A full width heading begins', x: 40, y: 630, width: 450, size: 14},
    {text: 'and continues across the gutter', x: 500, y: 630, width: 400, size: 14},
  ]), 1000).map(line => line.text);
  assert.equal(result[6], 'A full width heading begins and continues across the gutter');
  assert.equal(result[5], 'Right paragraph 2 describes the model validation and limitations.');
  assert.equal(result[7], 'Left paragraph 3 describes the study population and sample rules.');
});

test('numeric rows below two-column prose keep both sides on each row', () => {
  const table = rows(0, true).map(item => ({...item, y: item.y - 160}));
  const result = readingOrderLines(rows().concat(table), 1000).map(line => line.text);
  assert.equal(result[12], '1111110 2222220 3333330 4444440 5555550 6666660 7777770 8888880 9999990 0000000');
  assert.equal(result[13], '1111111 2222221 3333331 4444441 5555551 6666661 7777771 8888881 9999991 0000001');
});

test('sequential indented prose blocks are not mistaken for simultaneous columns', () => {
  const items = [700, 680, 660, 600, 580, 560, 500, 480, 460].map((y, index) => ({text: `Sequential line ${index} is part of a single ordered document flow.`, x: index >= 3 && index < 6 ? 540 : 40, y, width: 320, size: 10}));
  assert.deepEqual(readingOrderLines(items, 1000).map(line => line.text), items.map(item => item.text));
});
