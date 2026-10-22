import {expect,test,type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks,makeTextPdf,type MockState} from './helpers';
import type {PaperRecord} from '../../app/papers/paper-types';

const first: PaperRecord={id:'library-one',title:'Careful reading and empirical evidence',fileName:'evidence.pdf',addedAt:10,updatedAt:20,activeParagraph:1,paragraphs:[0,1,2].map(i=>({id:`source-${i}`,page:i+1,section:['Introduction','Methods','Results'][i],original:`Source paragraph ${i+1}. Research findings require careful interpretation and traceable evidence. `.repeat(5),translation:'',note:i===1?'Preserve this research note.':'',read:i===0,bookmarked:false}))};
const second: PaperRecord={...first,id:'library-two',title:'A long paper title about validation, inference and reproducible methods in observational research',fileName:'validation.pdf',addedAt:30,updatedAt:40,activeParagraph:0,paragraphs:first.paragraphs.map(p=>({...p,id:`second-${p.id}`}))};
const captures='outputs/paper-library-2026-10-22';
// The shared request stub intentionally does not persist successful PUTs. This
// suite adds a cloud store so reload/reconnect actually exercise round trips.
async function installLibraryMocks(page: Page, initial: Partial<MockState> = {}) {
  const state = await installApiMocks(page, initial);
  await page.route('**/api/cloud/papers', async route => {
    if (route.request().method()==='PUT' && state.signedIn && !state.failPaperSync && state.paperSyncStatus===200) {
      const record=route.request().postDataJSON() as PaperRecord;
      state.cloudPapers=[record,...state.cloudPapers.filter(item=>(item as PaperRecord).id!==record.id)];
    }
    await route.fallback();
  });
  return state;
}
const list=(page:import('@playwright/test').Page)=>page.getByRole('region',{name:'论文列表',exact:true});
const open=(page:import('@playwright/test').Page,paper:PaperRecord)=>page.getByRole('button',{name:`打开论文：${paper.title}`,exact:true});
const more=(page:import('@playwright/test').Page,paper:PaperRecord)=>page.getByRole('button',{name:`更多操作：${paper.title}`,exact:true});

test('LIBRARY-01 default selection precedes reading, preserves notes and supports back/forward',async({page})=>{
  const state=await installLibraryMocks(page,{signedIn:true,cloudPapers:[first,second]});
  await page.goto('/papers');await expect(open(page,first)).toBeVisible();
  await expect(page.getByRole('region',{name:'论文正文',exact:true})).toHaveCount(0);
  await page.getByRole('searchbox',{name:'搜索论文'}).fill('careful');
  await expect(open(page,second)).toHaveCount(0);
  await open(page,first).click();await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(first.title);
  await expect(page).toHaveURL(/view=reader.*paper=library-one/);
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记',{exact:true})).toHaveValue('Preserve this research note.');
  await page.getByLabel('段落笔记',{exact:true}).fill('A new note survives the return to the library.');
  await page.getByRole('button',{name:'返回论文列表',exact:true}).click();
  await expect(list(page)).toBeVisible();await expect(page.getByRole('searchbox',{name:'搜索论文'})).toHaveValue('careful');
  await expect(open(page,first)).toBeFocused();
  await page.getByRole('button',{name:`收藏 ${first.title}`,exact:true}).click();
  await expect.poll(()=>state.cloudPapers.some(p=>(p as PaperRecord).id===first.id&&(p as PaperRecord).favorite)).toBe(true);
  expect((state.cloudPapers.find(p=>(p as PaperRecord).id===first.id) as PaperRecord).paragraphs[1].note).toBe('A new note survives the return to the library.');
  await open(page,first).click();await expect(page.getByLabel('段落笔记',{exact:true})).toHaveValue('A new note survives the return to the library.');
  await page.goBack();await expect(list(page)).toBeVisible();
  await page.goForward();await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(first.title);
  await page.reload();await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(first.title);
});

test('LIBRARY-02 favorites survive offline sync, reload and another owner',async({page})=>{
  const state=await installLibraryMocks(page,{signedIn:true,cloudPapers:[second,first],failPaperSync:true});
  await page.goto('/papers');await expect(open(page,first)).toBeVisible();
  await page.getByRole('button',{name:`收藏 ${first.title}`,exact:true}).click();
  await expect(page.getByRole('button',{name:`取消收藏 ${first.title}`,exact:true})).toHaveAttribute('aria-pressed','true');
  await page.reload();await expect(page.getByRole('button',{name:`取消收藏 ${first.title}`,exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('group',{name:'论文列表范围'}).getByRole('button',{name:'收藏',exact:true}).click();
  await expect(open(page,second)).toHaveCount(0);await expect(open(page,first)).toBeVisible();
  state.failPaperSync=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await expect.poll(()=>state.cloudPapers.some(p=>(p as PaperRecord).id===first.id&&(p as PaperRecord).favorite)).toBe(true);
  expect((state.cloudPapers.find(p=>(p as PaperRecord).id===first.id) as PaperRecord).paragraphs).toEqual(first.paragraphs);
  await page.getByRole('button',{name:`取消收藏 ${first.title}`,exact:true}).click();
  await expect(list(page).getByText('没有找到符合条件的论文',{exact:true})).toBeVisible();
  await expect.poll(()=>(state.cloudPapers.find(p=>(p as PaperRecord).id===first.id) as PaperRecord)?.favorite).toBe(false);
  state.userId='another-owner';state.cloudPapers=[];await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
  await expect(list(page).getByText('还没有论文',{exact:true})).toBeVisible();
  await expect(open(page,first)).toHaveCount(0);
});

test('LIBRARY-03 more actions are keyboard accessible, metadata stays in the list and deletion is confirmed',async({page})=>{
  const state=await installApiMocks(page,{signedIn:true,cloudPapers:[first,second]});
  await page.goto('/papers');await expect(open(page,first)).toBeVisible();
  await more(page,first).click();await expect(page.getByRole('menuitem',{name:'文献资料与引用',exact:true})).toBeFocused();
  await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'删除论文',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');await expect(more(page,first)).toBeFocused();
  await more(page,first).click();await page.getByRole('menuitem',{name:'文献资料与引用',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'书目信息与引用'})).toBeVisible();
  await expect(page.getByRole('region',{name:'论文正文',exact:true})).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await more(page,first).click();
  const declined=page.waitForEvent('dialog');const declinedClick=page.getByRole('menuitem',{name:'删除论文',exact:true}).click();
  const confirmation=await declined;expect(confirmation.message()).toContain(first.title);expect(confirmation.message()).toContain('所有设备');await confirmation.dismiss();await declinedClick;
  await expect(open(page,first)).toBeVisible();
  await more(page,first).click();
  const accepted=page.waitForEvent('dialog');const acceptedClick=page.getByRole('menuitem',{name:'删除论文',exact:true}).click();await (await accepted).accept();await acceptedClick;
  await expect(open(page,first)).toHaveCount(0);await expect(open(page,second)).toBeVisible();
  await expect.poll(()=>state.cloudDeletions.some(p=>p.id===first.id)).toBe(true);
  await page.reload();await expect(open(page,first)).toHaveCount(0);
});

test('LIBRARY-04 source paragraph links still enter the correct workspace and missing sources return to the list',async({page})=>{
  await installApiMocks(page,{signedIn:true,cloudPapers:[first,second]});
  await page.goto(`/papers?paper=${first.id}&paragraph=source-1`);
  await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(first.title);
  await expect(page.locator('[data-paragraph-index="1"]')).toHaveAttribute('data-active','true');
  await page.goto('/papers?paper=not-in-this-account&paragraph=source-1');
  await expect(list(page)).toBeVisible();await expect(page.getByRole('status').filter({hasText:'当前账户未找到原论文'})).toBeVisible();
  await expect(page.getByRole('region',{name:'论文正文',exact:true})).toHaveCount(0);
});

test('LIBRARY-05 empty libraries offer explicit demo reading and PDF import enters its new workspace',async({page})=>{
  await installApiMocks(page);await page.goto('/papers');
  await expect(list(page).getByText('还没有论文',{exact:true})).toBeVisible();
  await expect(page.getByText('示例论文 · 仅供阅读演示',{exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'打开示例论文',exact:true}).click();
  await expect(page.getByText('示例论文 · 仅供阅读演示',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'返回论文列表',exact:true}).click();
  await page.getByLabel('导入英文论文 PDF',{exact:true}).setInputFiles({name:'local-library.pdf',mimeType:'application/pdf',buffer:makeTextPdf()});
  await expect(page.locator('.paper-source-record')).toContainText('local-library.pdf',{timeout:30000});
  await page.getByRole('button',{name:'返回论文列表',exact:true}).click();
  await expect(list(page)).toContainText('local-library.pdf');
});

test('LIBRARY-07 larger libraries scroll inside the list and support actual title sorting',async({page})=>{
  const papers=Array.from({length:35},(_,i)=>({...first,id:`many-${i}`,title:`Paper ${String(i).padStart(2,'0')} on evidence`,addedAt:i+1}));
  await installApiMocks(page,{signedIn:true,cloudPapers:papers});await page.setViewportSize({width:1440,height:900});
  await page.goto('/papers');await expect(open(page,papers[34])).toBeVisible();
  const bounds=await list(page).boundingBox();expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(901);
  await open(page,papers[0]).scrollIntoViewIfNeeded();await expect(open(page,papers[0])).toBeInViewport();
  await page.getByRole('combobox',{name:'论文排序'}).selectOption('title');
  await expect(list(page).locator('article').first()).toHaveAttribute('aria-label',papers[0].title);
});

for(const width of [1440,1024,375])test(`LIBRARY-06 ${width}px list and action popovers stay readable and accessible`,async({page})=>{
  await installApiMocks(page,{signedIn:true,cloudPapers:[first,second]});await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/papers');await expect(open(page,second)).toBeVisible();await mkdir(captures,{recursive:true});
  await page.screenshot({path:`${captures}/library-${width}.png`});
  await more(page,second).click();const menu=page.getByRole('menu');await expect(menu).toBeVisible();
  const bounds=await menu.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width+1);
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await page.screenshot({path:`${captures}/library-menu-${width}.png`});await page.keyboard.press('Escape');
  await open(page,first).click();await expect(page.getByLabel('论文标题',{exact:true})).toHaveValue(first.title);await page.screenshot({path:`${captures}/workspace-${width}.png`});
  await page.getByRole('button',{name:'返回论文列表',exact:true}).click();await expect(list(page)).toBeVisible();
});
