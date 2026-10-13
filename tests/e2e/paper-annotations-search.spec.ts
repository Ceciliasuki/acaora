import {expect,test,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';

const captures='outputs/paper-reader-2026-10-13';
const original='Research evidence must be checked against original sources. 中文原文与批注保持一致。 '.repeat(15);
const paper={id:'annotation-fixture',title:'示例：原文阅读与批注',fileName:'annotation-example.pdf',addedAt:1,updatedAt:1,activeParagraph:0,
 paragraphs:['Introduction','Methods','Results'].map((section,index)=>({id:`annotation-${index}`,section,page:index+1,original:`${section}: ${original}`,translation:'',note:index===0?'保留已有段落笔记':'',bookmarked:false,read:false,annotations:[] as unknown[]}))};

async function selectText(page:Page,start=14,end=56,crossParagraph=false){
 await page.locator('[data-original-text]').first().evaluate((element,{start,end,crossParagraph})=>{
  function boundary(target:Element,offset:number):[Node,number]{const walker=document.createTreeWalker(target,NodeFilter.SHOW_TEXT);let node:Node|null;while((node=walker.nextNode())){const length=node.textContent?.length??0;if(offset<=length)return[node,offset];offset-=length;}throw new Error('Selection offset outside text');}
  const last=crossParagraph?document.querySelectorAll('[data-original-text]')[1]:element;
  const a=boundary(element,start),b=boundary(last,end),range=document.createRange();range.setStart(...a);range.setEnd(...b);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);
 },{start,end,crossParagraph});
 await expect(page.getByRole('toolbar',{name:'选中文字工具'})).toBeVisible();
}

for(const width of [1440,375])test(`annotations ${width}px retain original text, notes, edits and durable storage`,async({page})=>{
 await page.setViewportSize({width,height:width===375?812:1000});
 const state=await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
 await page.goto('/papers');
 await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
 await mkdir(captures,{recursive:true});
 await page.screenshot({path:`${captures}/reading-minimal-${width}.png`,animations:'disabled'});
 await selectText(page);
 await page.getByRole('button',{name:'添加批注',exact:true}).click();
 await expect(page.getByLabel('批注内容')).toBeFocused();
 await page.getByLabel('批注内容').fill('这段需要对照原文核查。');
 await page.getByRole('radio',{name:'蓝色',exact:true}).check();
 await page.getByRole('button',{name:'保存批注',exact:true}).click();
 await expect(page.getByRole('region',{name:'划线批注'})).toContainText('这段需要对照原文核查。');
 await expect(page.getByLabel('段落笔记',{exact:true})).toHaveValue('保留已有段落笔记');
 await expect.poll(()=>state.requestBodies.some(body=>JSON.stringify(body).includes('这段需要对照原文核查。'))).toBe(true);
 await page.screenshot({path:`${captures}/annotation-panel-${width}.png`,animations:'disabled'});
 await page.reload();
 await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
 if(width===375)await page.getByRole('tab',{name:'阅读',exact:true}).click();
 await expect(page.locator('[data-original-text]').first()).toHaveText(paper.paragraphs[0].original);
 const mark=page.getByRole('button',{name:`查看批注：${paper.paragraphs[0].original.slice(14,56)}`,exact:true});
 await expect(mark).toHaveClass(/color-blue/);
 await mark.click();
 await expect(page.getByLabel('批注内容')).toHaveValue('这段需要对照原文核查。');
 await page.getByLabel('批注内容').fill('修改后的批注');
 await page.getByRole('button',{name:'保存批注',exact:true}).click();
 await expect(page.getByRole('region',{name:'划线批注'})).toContainText('修改后的批注');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:/^删除批注：/}).click();
 await expect(page.locator('.paper-text-mark')).toHaveCount(0);
 await expect(page.getByLabel('段落笔记',{exact:true})).toHaveValue('保留已有段落笔记');
});

test('a cross-paragraph highlight reaches a second browser through the existing cloud record and account switches hide drafts',async({page,browser})=>{
 let stored:unknown=structuredClone(paper);
 async function setup(target:Page){
  const state=await installApiMocks(target,{signedIn:true,cloudPapers:[paper]});
  await target.route('**/api/cloud/papers',async route=>{if(!state.signedIn)return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'请先登录。'})});if(route.request().method()==='PUT')stored=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',headers:{'Cache-Control':'private, no-store'},body:JSON.stringify(route.request().method()==='GET'?{papers:[stored],deletions:[]}:{synced:true})});});
  return state;
 }
 await setup(page);await page.goto('/papers');await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
 await selectText(page,14,56,true);await page.getByRole('button',{name:'高亮',exact:true}).click();
 await expect.poll(()=>JSON.stringify(stored).includes('"annotations":[{')).toBe(true);
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const second=await context.newPage();const account=await setup(second);await second.goto('/papers');
 await expect(second.getByLabel('论文标题')).toHaveValue(paper.title);
 await expect(second.locator('.paper-text-mark')).toHaveCount(2);
 await second.locator('.paper-text-mark').first().click();
 await second.getByLabel('批注内容').fill('不应显示给另一个账户的未保存批注');
 account.signedIn=false;
 await second.evaluate(()=>window.dispatchEvent(new CustomEvent('acaora:auth-change')));
 await expect(second.getByLabel('批注内容')).toHaveCount(0);
 await expect(second.locator('.paper-text-mark')).toHaveCount(0);
 await expect(second.getByText('不应显示给另一个账户的未保存批注',{exact:true})).toHaveCount(0);
 expect(JSON.stringify(stored)).not.toContain('不应显示给另一个账户');
 await context.close();
});

test('public literature filters, page navigation, citation export and failure states are usable',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
 const queries:URLSearchParams[]=[];
 await page.route('**/api/papers/search?**',async route=>{
  const query=new URL(route.request().url()).searchParams;queries.push(query);
  if(query.get('q')==='失败')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'公共索引暂不可用，筛选条件已保留。'})});
  const number=Number(query.get('page')??1);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'Crossref',total:21,page:number,hasMore:number===1,papers:[{id:`fixture-${number}`,title:`示例文献 ${number}：中英文检索`,authors:['测试作者'],year:2024,venue:'示例期刊',abstract:'示例摘要，用于检查检索页面。',citationCount:null,type:'journal-article',doi:`10.1000/example${number}`,url:'https://doi.org/10.1000/example',pdfUrl:'',source:'Crossref'}]})});
 });
 await page.goto('/papers');await page.getByRole('button',{name:'学术检索',exact:true}).click();
 await page.getByLabel('检索字段',{exact:true}).selectOption('author');await page.getByLabel('论文检索关键词').fill('测试作者');
 await page.getByLabel('起始年份').fill('2020');await page.getByLabel('结束年份').fill('2025');await page.getByLabel('文献类型').selectOption('journal-article');await page.getByLabel('结果排序').selectOption('newest');
 await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.getByRole('heading',{name:'示例文献 1：中英文检索'})).toBeVisible();
 expect(Object.fromEntries(queries[0])).toEqual({q:'测试作者',field:'author',from:'2020',to:'2025',type:'journal-article',sort:'newest',page:'1'});
 await page.getByRole('checkbox',{name:'选择文献：示例文献 1：中英文检索'}).check();
 await mkdir(captures,{recursive:true});await page.screenshot({path:`${captures}/literature-results-1440.png`,animations:'disabled'});
 await page.getByLabel('论文检索关键词').fill('未提交的新条件');await page.getByRole('button',{name:'下一页',exact:true}).click();
 await expect(page.getByRole('heading',{name:'示例文献 2：中英文检索'})).toBeVisible();expect(queries[1].get('q')).toBe('测试作者');
 await page.getByRole('checkbox',{name:'选择文献：示例文献 2：中英文检索'}).check();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出引用（2）',exact:true}).click();const saved=await download;
 expect(await readFile((await saved.path())!,'utf8')).toContain('DO  - 10.1000/example1');
 await page.setViewportSize({width:375,height:812});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
 await page.screenshot({path:`${captures}/literature-results-375.png`,animations:'disabled'});
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.getByLabel('论文检索关键词').fill('失败');await page.getByRole('button',{name:'检索',exact:true}).click();await expect(page.getByRole('region',{name:'文献检索'}).getByRole('alert')).toContainText('公共索引暂不可用');
 await expect(page.getByLabel('起始年份')).toHaveValue('2020');await expect(page.locator('.literature-empty')).toHaveCount(0);
});
