import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks,openPaperLibrary,type MockProject} from './helpers';
import type {PaperRecord} from '../../app/papers/paper-types';

const out='outputs/research-workflows-2026-10-21';
const now='2026-10-21T08:00:00.000Z';
const source:PaperRecord={id:'workflow-paper',title:'Evidence and statistical reasoning',fileName:'evidence.pdf',addedAt:1,updatedAt:1,activeParagraph:0,
  paragraphs:['Introduction','Methods'].map((section,index)=>({id:`source-${index}`,section,page:index+1,original:`${section}: Source evidence and repeated sampling should be checked carefully.`,translation:'保留译文',note:index?'方法笔记':'原有笔记',read:false,bookmarked:false,
    annotations:index?[]:[{id:'highlight-one',start:14,end:29,quote:'Source evidence',comment:'保留批注',color:'yellow',createdAt:2}]}))};
const project:MockProject={id:'workflow-project',title:'文献复核项目',kind:'paper',status:'active',metadata:{notes:'保留项目笔记',tasks:[{id:'task-one',text:'核对研究设计',done:false}]},created_at:now,updated_at:now};

async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}
async function capture(page:Page,name:string){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
async function audit(page:Page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);}

for(const width of [1440,375]) {
  test(`reader bibliography tool fits the existing reading toolbar ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===375?812:1000});
    await installApiMocks(page,{signedIn:true,cloudPapers:[{...source,bibliography:{authors:['A Researcher'],year:2024,venue:'Research Methods',doi:'10.1234/evidence',url:'',tags:['证据'],source:'manual',confirmed:true}}]});
    await page.goto('/papers?view=reader');await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(source.title);
    if(width===375)await page.getByRole('button',{name:'论文工具',exact:true}).click();
    const tool=page.getByRole('button',{name:'文献资料与引用 · 已确认'});
    const activeTool=width===375?page.locator('#mobile-paper-tools').getByRole('button',{name:'文献资料与引用',exact:true}):tool;await expect(activeTool).toBeVisible();
    await noOverflow(page);await capture(page,`reader-toolbar-${width}`);
    await activeTool.click();await expect(page.getByRole('dialog',{name:'书目信息与引用'})).toBeVisible();
  });
  test(`research bibliography, backup and project source round trip ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===375?812:1000});
    await page.addInitScript(()=>localStorage.setItem('acaora:paper-panels',JSON.stringify({library:false,notes:true})));
    const state=await installApiMocks(page,{signedIn:true,cloudPapers:[source],projects:[project]});
    await page.route('**/api/papers/search?**',route=>route.fulfill({json:{papers:[{title:'Crossref candidate title',authors:['A Researcher','B Scholar'],year:2024,venue:'Research Methods',doi:'10.1234/evidence',url:'https://doi.org/10.1234/evidence'}]}}));
    await page.goto('/papers?view=reader');
    await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(source.title);
    if(width===375)await page.getByRole('button',{name:'论文工具',exact:true}).click();
    await (width===375?page.locator('#mobile-paper-tools').getByRole('button',{name:'文献资料与引用',exact:true}):page.getByRole('button',{name:/文献资料与引用/})).click();
    const dialog=page.getByRole('dialog',{name:'书目信息与引用'});
    await expect(dialog.getByRole('button',{name:'导出 BibTeX'})).toBeDisabled();
    await dialog.getByLabel('DOI',{exact:true}).fill('10.1234/evidence');
    await dialog.getByRole('button',{name:'用 DOI 查询 Crossref'}).click();
    await expect(dialog.getByText('Crossref candidate title',{exact:true})).toBeVisible();
    await expect(dialog.getByLabel('作者（每行一位）')).toHaveValue('');
    await dialog.getByRole('button',{name:'采用资料填入表单'}).click();
    await dialog.getByLabel('主题标签（逗号分隔）').fill('研究方法,证据');
    await dialog.getByRole('checkbox',{name:/我已核对/}).check();
    await noOverflow(page);await audit(page);await capture(page,`bibliography-${width}`);
    const citationDownload=page.waitForEvent('download');await dialog.getByRole('button',{name:'导出 BibTeX'}).click();
    const citation=await citationDownload;const citationText=await readFile((await citation.path())!,'utf8');
    expect(citationText).toContain(source.title);expect(citationText).toContain('A Researcher and B Scholar');expect(citationText).not.toContain('Crossref candidate title');
    await dialog.getByRole('button',{name:'保存书目信息'}).click();
    await expect.poll(()=>state.requestBodies.some(body=>(body as PaperRecord).bibliography?.confirmed)).toBe(true);
    await openPaperLibrary(page);
    await page.getByLabel('论文标签筛选').selectOption('证据');
    await expect(page.locator('.plab-index-open')).toHaveCount(1);
    const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'备份记录',exact:true}).click();
    const backup=await backupDownload;const backupText=await readFile((await backup.path())!,'utf8');const backupJson=JSON.parse(backupText);
    expect(backupJson.papers).toHaveLength(1);expect(backupJson.papers[0].ownerId).toBeUndefined();expect(backupJson.papers[0].paragraphs[0].note).toBe('原有笔记');
    await page.getByLabel('选择论文备份文件').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backupText)});
    const restore=page.getByRole('dialog',{name:'恢复研究记录'});await expect(restore).toContainText('1 条批注');
    await restore.getByRole('button',{name:'恢复 1 篇新副本'}).click();
    await expect(page.locator('.plab-index-open')).toHaveCount(2);
    await expect.poll(()=>state.requestBodies.some(body=>typeof (body as PaperRecord).id==='string'&&(body as PaperRecord).id!==source.id&&Boolean((body as PaperRecord).paragraphs))).toBe(true);
    if(width===375)await page.getByRole('tab',{name:'笔记',exact:true}).click();
    else await page.getByRole('button',{name:'论文库',exact:true}).click();
    await page.getByRole('region',{name:'划线批注'}).getByRole('button',{name:'加入项目',exact:true}).click();
    const picker=page.getByRole('dialog',{name:'将摘录加入项目'});
    await picker.getByLabel('个人评论',{exact:true}).fill('我的解释，与原文分开保存');
    await picker.getByRole('button',{name:'加入项目',exact:true}).click();
    await expect(picker).not.toBeVisible();
    expect(state.projects[0].metadata.notes).toBe('保留项目笔记');expect(state.projects[0].metadata.tasks).toHaveLength(1);
    await page.goto('/projects?project=workflow-project');
    const evidence=page.locator('.project-evidence');await expect(evidence).toContainText('Source evidence');await expect(evidence).toContainText('我的解释，与原文分开保存');
    await noOverflow(page);await capture(page,`project-evidence-${width}`);
    await evidence.getByRole('link',{name:'返回原文',exact:true}).click();
    await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(source.title);
    if(width===375)await page.getByRole('tab',{name:'笔记',exact:true}).click();
    await expect(page.getByLabel('段落笔记',{exact:true})).toHaveValue('原有笔记');
  });

  test(`analysis recipes stage and explicitly rerun with changed data ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===375?812:1000});await installApiMocks(page);await page.goto('/data#analysis');
    await page.getByText('保存与重跑分析方案',{exact:true}).click();
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出当前方案'}).click();
    const file=await download;const text=await readFile((await file.path())!,'utf8');const json=JSON.parse(text);
    expect(json.dataset.fingerprint).toMatch(/^[a-f0-9]{64}$/);expect(json.dataset.rows).toBe(24);expect(text).not.toContain('S01');
    await page.getByRole('combobox',{name:'分析变量',exact:true}).selectOption('年龄');
    await page.getByLabel('选择分析方案文件').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(text)});
    await expect(page.getByRole('combobox',{name:'分析变量',exact:true})).toHaveValue('年龄');
    await expect(page.getByText(/数据指纹一致/)).toBeVisible();
    await page.getByRole('button',{name:'应用并重算'}).click();
    await expect(page.getByRole('combobox',{name:'分析变量',exact:true})).toHaveValue('睡眠时长');
    await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'new.csv',mimeType:'text/csv',buffer:Buffer.from('measure,response\n1,2\n2,4\n3,5\n4,7')});
    await page.getByText('保存与重跑分析方案',{exact:true}).click();
    await page.getByLabel('选择分析方案文件').setInputFiles({name:'recipe.json',mimeType:'application/json',buffer:Buffer.from(text)});
    await expect(page.getByText(/数据指纹不同/)).toBeVisible();
    const apply=page.getByRole('button',{name:'应用并重算'});await expect(apply).toBeDisabled();
    await page.getByLabel('方案分析变量',{exact:true}).selectOption('response');
    await page.getByRole('checkbox',{name:'我已确认变量映射，使用当前数据重算'}).check();
    await noOverflow(page);await capture(page,`recipe-staging-${width}`);await audit(page);
    await apply.click();await expect(page.getByRole('combobox',{name:'分析变量',exact:true})).toHaveValue('response');
  });

  test(`confidence interval experiment repeats and resets without course completion ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===375?812:1000});const state=await installApiMocks(page);await page.goto('/courses/STAT-201/lesson-8');
    const experiment=page.getByRole('region',{name:'亲手观察置信区间的覆盖'});
    await experiment.getByRole('button',{name:'抽样 50 次'}).click();
    await expect(experiment.locator('.interval-experiment-status')).toContainText('已生成 50 个区间');
    const first=await experiment.locator('.interval-experiment-latest').innerText();
    await noOverflow(page);await capture(page,`course-experiment-${width}`);await audit(page);
    await experiment.getByRole('button',{name:'重置本轮'}).click();await experiment.getByRole('button',{name:'抽样 50 次'}).click();
    await expect(experiment.locator('.interval-experiment-latest')).toHaveText(first);
    await experiment.getByRole('combobox',{name:/置信度/}).selectOption('0.99');await expect(experiment.locator('.interval-experiment-status')).toContainText('尚未抽样');
    expect(state.requests.filter(key=>/PUT .*progress/.test(key))).toEqual([]);
  });
}
