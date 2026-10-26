import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {installApiMocks,type MockProject} from './helpers';
import {mkdir} from 'node:fs/promises';
import {columnPdf} from './revision-pdf-fixture';

const stamp='2026-10-23T00:00:00.000Z';
const project:MockProject={id:'review-project',title:'Review project',kind:'paper',status:'active',metadata:{notes:'Original notes',goal:'Original goal',tasks:[{id:'task-1',text:'Original completed task',done:true}]},created_at:stamp,updated_at:stamp};

test('REV-B controlled original PDF keeps columns, table numbers, signs and source pages',async({page})=>{
 await installApiMocks(page);await page.goto('/papers');
 await page.getByLabel('导入英文论文 PDF').setInputFiles({name:'controlled-columns.pdf',mimeType:'application/pdf',buffer:columnPdf()});
 await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Columns and Numeric Tables',{timeout:15000});
 const source=await page.locator('[data-original-text]').allTextContents(),text=source.join(' ');
 expect(text.indexOf('Left line 1-2')).toBeLessThan(text.indexOf('Right line 1-0'));
 expect(text).toContain('100 200 300 400 500 600');expect(text).toContain('coefficient is -0.5');expect(text).toContain('well-being');
 expect(text).not.toContain('Controlled repeating header');expect(text).toContain('Left line 2-0');
 await page.getByRole('button',{name:'查看原 PDF',exact:true}).click();
 const canvas=page.getByLabel('原 PDF 第 1 页',{exact:true});await expect(canvas).toBeVisible();
 await mkdir('outputs/revision-2026-10-23',{recursive:true});await canvas.screenshot({path:'outputs/revision-2026-10-23/controlled-original-pdf.png'});
});

test('REV-D1-CONFLICT editor reviews remote target changes and preserves unrelated fields',async({page})=>{
  const state=await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.goto('/projects');await page.getByRole('button',{name:'编辑项目资料',exact:true}).click();
  const form=page.getByRole('form',{name:'编辑项目资料'});await form.getByLabel('项目名称',{exact:true}).fill('My retained title');
  let first=true;
  await page.route('**/api/projects?**',route=>{if(route.request().method()!=='PATCH'||!first)return route.fallback();first=false;state.projects=[{...state.projects[0],title:'Remote title',updated_at:'2026-10-23T01:00:00.000Z',metadata:{...state.projects[0].metadata,notes:'Latest remote notes'}}];return route.fulfill({status:409,json:{error:'模拟并发修改'}});});
  await form.getByRole('button',{name:'保存项目资料'}).click();
  await expect(form.getByRole('button',{name:'保存项目资料'})).toBeDisabled();
  await expect(form.getByLabel('项目名称',{exact:true})).toHaveValue('My retained title');
  await form.getByRole('button',{name:'保留输入并继续编辑资料'}).click();
  await form.getByRole('button',{name:'保存项目资料'}).click();
  await expect(page.getByRole('heading',{name:'My retained title',exact:true})).toBeVisible();
  expect(state.projects[0].metadata.notes).toBe('Latest remote notes');
});

for(const width of [1366,375])test(`REV-UI affected surfaces at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===375?812:768});await page.emulateMedia({reducedMotion:'reduce'});
  await installApiMocks(page,{signedIn:true,projects:[project]});
  const out='outputs/revision-2026-10-23';await mkdir(out,{recursive:true});
  await page.goto('/data');await page.getByRole('tab',{name:'多元回归',exact:true}).click();
  const run=page.getByRole('button',{name:'拟合模型',exact:true});await run.focus();await expect(run).toBeFocused();await run.press('Enter');
  await expect(page.getByRole('region',{name:'多元回归结果',exact:true})).toBeVisible();
  await page.getByRole('region',{name:'回归分析设置',exact:true}).screenshot({path:`${out}/regression-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto('/projects');await page.getByRole('button',{name:'编辑项目资料',exact:true}).click();
  await page.getByRole('form',{name:'编辑项目资料'}).screenshot({path:`${out}/project-edit-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.goto('/courses');await expect(page.getByRole('region',{name:'继续学习'})).not.toContainText('正在读取');
  await page.screenshot({path:`${out}/courses-${width}.png`,animations:'disabled'});
  await page.goto('/');await expect(page.getByRole('figure',{name:'原文与笔记示例'})).toBeVisible();
  await page.getByRole('figure',{name:'原文与笔记示例',exact:true}).screenshot({path:`${out}/home-example-${width}.png`,animations:'disabled'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('REV-F capture public product example without private records',async({page})=>{
  test.skip(process.env.ACAORA_CAPTURE_PUBLIC_PREVIEW!=='1','Only regenerate public screenshots explicitly.');
  await installApiMocks(page);
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/papers');
  await page.getByRole('button',{name:'打开示例论文',exact:true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue('Statistical learning in observational studies: principles and practice');
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await page.getByRole('button',{name:'Methods',exact:true}).first().click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('重点检查是否存在数据泄漏。');
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.plab-shell').screenshot({path:'public/preview-reader.png',animations:'disabled'});
  await page.setViewportSize({width:375,height:812});
  await page.getByRole('tab',{name:'阅读',exact:true}).click();
  await page.addStyleTag({content:'.paper-mobile-tabs,.sidebar-menu-button,[class*="workspace-accessibility_skip"]{visibility:hidden!important}'});
  await page.locator('.plab-paragraph').nth(1).screenshot({path:'public/preview-reader-mobile.png',animations:'disabled'});
});

test('REV-D2 catalog reads progress once without writing completion and resumes the correct lesson',async({page})=>{
  const key=JSON.stringify(['user-e2e','STAT-201']);
  const state=await installApiMocks(page,{signedIn:true,courseRecords:{[key]:{courseId:'STAT-201',generation:1,lastLessonId:'lesson-2',completedLessonIds:['lesson-1'],attempts:[]}}});
  await page.goto('/courses');
  const resume=page.getByRole('region',{name:'继续学习'});
  await expect(resume).toContainText('已标记完成 1 节');
  expect(state.requests.filter(request=>/^(PUT|POST).*courses/.test(request))).toHaveLength(0);
  expect(state.requests.filter(request=>request==='GET /api/courses/STAT-201/progress')).toHaveLength(1);
  await resume.getByRole('link',{name:'继续学习：概率论与数理统计'}).click();
  await expect(page).toHaveURL(/\/courses\/STAT-201\/lesson-2/,{timeout:15000});
});

test('REV-D2-ERROR progress failures and anonymous states do not invent zero completion',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,courseReadStatus:503});await page.goto('/courses');
 const resume=page.getByRole('region',{name:'继续学习'});
 await expect(resume).toContainText('账户进度尚未确认');await expect(resume.getByRole('link')).toHaveCount(0);
 expect(state.requests.filter(request=>/^(PUT|POST).*courses/.test(request))).toHaveLength(0);
 state.signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(resume).toContainText('登录后可读取账户的上次课时');
});

test('REV-C histogram exposes the exact nine shared bins without persistent storage boilerplate',async({page})=>{
  await installApiMocks(page);await page.goto('/data');
  await expect(page.getByText(/当前数据与固定结果仅在本次页面会话/)).toHaveCount(0);
  await page.getByText('查看区间与频数表 · 单位未提供',{exact:true}).click();
  const rows=page.getByRole('table',{name:/原始区间端点与频数/}).locator('tbody tr');
  await expect(rows).toHaveCount(9);
  const counts=await rows.locator('td').allTextContents();
  const bars=await page.locator('.histogram-column span').allTextContents();
  expect(counts.map(Number)).toEqual(bars.map(Number));
  // The 24-row sample contains one missing value in its initial sleep column.
  expect(counts.reduce((sum,value)=>sum+Number(value),0)).toBe(23);
  await expect(rows.last().locator('th')).toContainText(']');
});

test('REV-D3 AI configuration returns exact paper, paragraph and action without a paid request',async({page})=>{
  const paper={id:'ai-return-paper',title:'Controlled AI task',fileName:'task.pdf',addedAt:1,updatedAt:1,activeParagraph:0,paragraphs:[0,1].map(i=>({id:`ai-p-${i}`,page:i+1,section:'Methods',original:'The study describes the methods and the results with independent source evidence. '.repeat(5),translation:'',note:'',read:false,bookmarked:false}))};
  const state=await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers?view=reader&paper=ai-return-paper&paragraph=ai-p-1&mode=ai&action=chat');
  await expect(page.getByRole('tab',{name:'论文问答',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByLabel('向论文提问',{exact:true}).fill('Retain this specific question');
  await page.getByRole('link',{name:'配置模型，返回后执行'}).click();
  await page.getByLabel('DeepSeek API Key',{exact:true}).fill('sk-controlled-test-placeholder');
  await page.getByRole('button',{name:'保存到当前会话'}).click();
  await page.getByRole('link',{name:'返回原来的 AI 任务'}).click();
  await expect(page.getByRole('tab',{name:'论文问答',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('向论文提问',{exact:true})).toHaveValue('Retain this specific question');
  await expect(page.locator('.ai-console-context')).toContainText('2 / 2');
  expect(state.requests.filter(request=>request==='POST /api/papers/ai')).toHaveLength(0);
  await page.goto('/settings?returnTo=https%3A%2F%2Fevil.example%2F');
  await expect(page.getByRole('link',{name:'返回原来的 AI 任务'})).toHaveCount(0);
});

test('REV-G snapshot links project evidence, interpretation, task and backup recovery',async({page})=>{
  const source={id:'chain-paper',title:'Controlled chain source',fileName:'chain.pdf',addedAt:1,updatedAt:1,activeParagraph:0,paragraphs:[{id:'chain-p1',page:1,section:'Methods',original:'The study compares the results with the independent source evidence and reports the uncertainty in the data.',translation:'',note:'',read:false,bookmarked:false}]};
  const evidence={id:'chain-evidence',paperId:source.id,paragraphId:'chain-p1',paperTitle:source.title,fileName:source.fileName,page:1,section:'Methods',quote:source.paragraphs[0].original,comment:'Controlled source',createdAt:1};
  const projectWithEvidence={...project,metadata:{...project.metadata,evidence:[evidence]}};
  const state=await installApiMocks(page,{signedIn:true,projects:[projectWithEvidence],cloudPapers:[source]});
  await page.goto('/data');
  await page.getByText('保存快照与导出复现包',{exact:true}).click();
  await page.getByLabel('分析快照名称',{exact:true}).fill('Controlled snapshot');
  await page.getByRole('button',{name:'保存命名快照',exact:true}).click();
  await page.getByText(/分析历史与版本对照/).click();
  const chooser=page.getByRole('combobox',{name:'查看快照',exact:true});
  await expect(chooser.locator('option').filter({hasText:'Controlled snapshot'})).toHaveCount(1);
  await chooser.selectOption((await chooser.locator('option').filter({hasText:'Controlled snapshot'}).getAttribute('value'))!);
  await page.getByText('关联快照到项目',{exact:true}).click();
  await page.getByRole('combobox',{name:'关联项目',exact:true}).selectOption('review-project');
  await page.getByRole('combobox',{name:'对应论文证据（可选）',exact:true}).selectOption('chain-evidence');
  await page.getByLabel('分析解释',{exact:true}).fill('An exploratory summary, with its source retained.');
  await page.getByLabel('下一步任务（可选）',{exact:true}).fill('Check the source before interpreting the pattern');
  await page.getByRole('button',{name:'保存关联与下一步'}).click();
  await page.getByRole('link',{name:'打开关联项目'}).click();
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue(/Original notes/);
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue(/对应论文证据 ID：chain-evidence/);
  await expect(page.getByRole('button',{name:'编辑任务：Check the source before interpreting the pattern'})).toBeVisible();
  await page.getByRole('link',{name:'返回原文',exact:true}).click();
  await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(source.title);
  await page.getByRole('link',{name:'研究项目',exact:true}).click();
  await page.getByRole('link',{name:'打开分析快照：Controlled snapshot'}).click();
  await expect(page.getByRole('region',{name:'已保存分析快照'})).toContainText('Controlled snapshot');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出此快照 JSON'}).click();
  const backup=await readFile((await (await download).path())!,'utf8');
  const malformed=JSON.parse(backup);malformed.dataset.rows='invalid';
  await page.getByLabel('从 JSON 恢复快照',{exact:true}).setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malformed))});
  await expect(page.getByRole('status').filter({hasText:'数据身份格式无效'})).toBeVisible();
  expect(backup).not.toContain('S01');
  await page.getByRole('button',{name:'删除此快照'}).click();
  await expect(page.getByRole('alert').filter({hasText:'此账户在本机没有这份快照'})).toBeVisible();
  await page.getByLabel('从 JSON 恢复快照',{exact:true}).setInputFiles({name:'snapshot.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await expect(page.getByRole('region',{name:'已保存分析快照'})).toContainText('Controlled snapshot');
  expect(state.projects[0].metadata.tasks).toHaveLength(2);
  state.userId='another-owner';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(page.getByRole('alert').filter({hasText:'此账户在本机没有这份快照'})).toBeVisible();
});

test('REV-D1 edit metadata and task preserves unrelated fields, failed drafts and removal confirmation',async({page})=>{
  const state=await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.goto('/projects');
  await page.getByRole('button',{name:'编辑项目资料',exact:true}).click();
  const form=page.getByRole('form',{name:'编辑项目资料'});
  await form.getByLabel('项目名称',{exact:true}).fill('Updated project');
  await form.getByLabel('项目目标',{exact:true}).fill('Updated goal');
  await form.getByRole('button',{name:'保存项目资料'}).click();
  await expect(page.getByRole('heading',{name:'Updated project',exact:true})).toBeVisible();
  expect(state.projects[0].metadata.notes).toBe('Original notes');
  await page.getByRole('button',{name:'编辑任务：Original completed task'}).click();
  await page.getByLabel('任务文字',{exact:true}).fill('Edited completed task');
  await page.getByRole('button',{name:'保存任务文字'}).click();
  await expect.poll(()=>state.projects[0].metadata.tasks?.[0]).toEqual({id:'task-1',text:'Edited completed task',done:true});
  await page.getByRole('button',{name:'移除任务：Edited completed task'}).click();
  await page.getByRole('dialog',{name:'移除这项任务？'}).getByRole('button',{name:'取消',exact:true}).click();
  expect(state.projects[0].metadata.tasks).toHaveLength(1);
  await page.getByRole('button',{name:'移除任务：Edited completed task'}).click();
  await page.getByRole('button',{name:'确认移除任务'}).click();
  await expect.poll(()=>state.projects[0].metadata.tasks?.length).toBe(0);
  await page.getByRole('button',{name:'编辑项目资料',exact:true}).click();
  await form.getByLabel('项目名称',{exact:true}).fill('Failed draft stays');
  await page.route('**/api/projects?**',route=>route.request().method()==='PATCH'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'模拟保存失败'})}):route.fallback());
  await form.getByRole('button',{name:'保存项目资料'}).click();
  await expect(form.getByLabel('项目名称',{exact:true})).toHaveValue('Failed draft stays');
  await form.getByRole('button',{name:'取消编辑资料'}).click();
  await expect(page.getByRole('heading',{name:'Updated project',exact:true})).toBeVisible();
});

test('REV-E keyboard skip link bypasses navigation and route titles remain public',async({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.goto('/projects');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'跳到主要内容'})).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(()=>document.activeElement?.classList.contains('project-main'))).toBe(true);
  await expect(page).toHaveTitle('项目空间 · Acaora 学曦');
  await page.getByRole('link',{name:'帮助与恢复',exact:true}).click();
  await expect(page).toHaveTitle('帮助与恢复 · Acaora 学曦');
  await expect(page.getByRole('heading',{name:'保存与备份'})).toBeVisible();
});
