import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/papers/reader-find.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {findInPaper} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const find = (texts, query, caseSensitive = false) => findInPaper(texts.map(original => ({original})), {query, caseSensitive});

test('search treats regex syntax as literal text and ignores blank queries', () => {
  assert.deepEqual(find(['A [P1] (p<.05) and C++'], '[P1]')[0].ranges, [{start: 2, end: 6}]);
  assert.equal(find(['C++'], 'C++').length, 1);
  assert.deepEqual(find(['anything'], '  '), []);
});
test('search offsets remain source UTF-16 offsets with emoji and mixed scripts', () => {
  const text = '📑 İ原文 研究 研究';
  const result = find([text], '研究');
  assert.equal(result[0].ranges.length, 2);
  for (const range of result[0].ranges) assert.equal(text.slice(range.start, range.end), '研究');
  assert.equal(find(['İ sample'], 'sample')[0].ranges[0].start, 2);
});
test('case options, repeated hits and paragraph counts agree without changing source records', () => {
  const paragraphs = [{original: 'Model model MODEL', annotations: [{start: 0, end: 5}], translation: '样本'}, {original: 'Another model'}];
  const before = structuredClone(paragraphs);
  const results = findInPaper(paragraphs, {query: 'model', caseSensitive: false});
  assert.equal(results.length, 2);
  assert.equal(results[0].ranges.length, 3);
  assert.equal(findInPaper(paragraphs, {query: 'model', caseSensitive: true})[0].ranges.length, 1);
  assert.deepEqual(findInPaper(paragraphs, {query: '样本', caseSensitive: false}), []);
  assert.deepEqual(paragraphs, before);
});
