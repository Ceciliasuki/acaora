import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../app/lib/research-links.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022}}).outputText;
const {withResearchProject, projectAnalysisLinks} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('research context preserves exact sources and local snapshot targets, then exits independently', () => {
  const paper = withResearchProject('/papers?paper=paper%2Fa&paragraph=Methods%203', 'project A');
  assert.equal(paper, '/papers?paper=paper%2Fa&paragraph=Methods+3&project=project+A');
  assert.equal(withResearchProject(paper, null), '/papers?paper=paper%2Fa&paragraph=Methods+3');
  assert.equal(withResearchProject('/data?snapshot=v1#history', 'A'), '/data?snapshot=v1&project=A#history');
  for (const href of ['https://elsewhere.example/data', '//elsewhere.example/papers', 'javascript:alert(1)', '/auth']) assert.throws(() => withResearchProject(href, 'A'));
});

test('existing project notes yield deduplicated local snapshot links without trusting stored destinations', () => {
  const notes = ['保留个人思路。', '[分析快照：模型一](/data?snapshot=one#history)', '[分析快照：模型一](/data?snapshot=one#history)', '[分析快照：导入备份](/data?snapshot=two&project=untrusted#history)', '[分析快照：外站](https://elsewhere.example/data?snapshot=secret#history)', '[分析快照：无效](/data?snapshot=%00#history)'].join('\n');
  assert.deepEqual(projectAnalysisLinks(notes), [{id: 'one', name: '模型一', href: '/data?snapshot=one#history'}, {id: 'two', name: '导入备份', href: '/data?snapshot=two#history'}]);
  assert.ok(notes.startsWith('保留个人思路。'));
  assert.deepEqual(projectAnalysisLinks('笔记已重新整理，未保留旧链接。', [{snapshotId:'registered-one',name:'登记的主模型'}]), [{id:'registered-one',name:'登记的主模型',href:'/data?snapshot=registered-one#history'}]);
});
