import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/papers/annotation-collection.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {annotationKey, annotationMarkdown} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('extracts retain source order, pages, separate comments and exact multi-line quotes', () => {
  const entries = [
    {paragraphId: 'b', index: 4, section: 'Results', page: 7, annotation: {start: 12, quote: 'Later source', comment: '', createdAt: 1}},
    {paragraphId: 'a', index: 0, section: 'Methods', page: 2, annotation: {start: 4, quote: 'Exact source\n第二行', comment: 'My interpretation', createdAt: 9}},
  ];
  const before = structuredClone(entries);
  const markdown = annotationMarkdown({title: 'Evidence study', fileName: 'study.pdf'}, entries);
  assert.ok(markdown.indexOf('Methods · P1 · 第 2 页') < markdown.indexOf('Results · P5 · 第 7 页'));
  assert.ok(markdown.includes('> Exact source\n> 第二行'));
  assert.ok(markdown.includes('个人评论：\n\nMy interpretation'));
  assert.deepEqual(entries, before);
});
test('selection keys cannot collide across paragraphs or delimiter characters', () => {
  assert.notEqual(annotationKey('a:b', 'c'), annotationKey('a', 'b:c'));
  assert.notEqual(annotationKey('first', 'shared'), annotationKey('second', 'shared'));
});
