import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';

const paper = {id:'wide-reader',title:'A paper for focused reading',fileName:'reader.pdf',addedAt:1,updatedAt:1,activeParagraph:0,
  paragraphs:['Introduction','Methods','Results'].map((section,index)=>({id:`wide-${index}`,page:index+1,section,
    original:`${section}: `+'A continuous paper should leave room to read while keeping notes available on demand. '.repeat(30),
    translation:'',note:`${section} note`,bookmarked:false,read:false}))};

test('PAPER-17 collapsed side panels give the reader space without losing paragraph notes',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.plab-index')).toBeHidden();
  await expect(page.locator('.plab-rail')).toBeHidden();
  const reader=page.getByRole('region',{name:'论文正文',exact:true});
  const wide=await reader.boundingBox();
  expect(wide!.width).toBeGreaterThan(950);
  const body=await page.locator('.plab-body').boundingBox();
  expect(body!.width).toBeGreaterThan(650);
  expect(Math.abs(body!.x+body!.width/2-wide!.x-wide!.width/2)).toBeLessThan(2);
  await reader.hover();await page.mouse.wheel(0,10000);
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Results note');
  await page.getByLabel('段落笔记').fill('Keep this note while panels collapse.');
  await page.getByRole('button',{name:'论文库',exact:true}).click();
  await expect(page.getByRole('button',{name:`${paper.title} 3 段 · 已读 0%`,exact:true})).toBeVisible();
  const narrow=await reader.boundingBox();
  expect(wide!.width-narrow!.width).toBeGreaterThan(300);
  await page.getByRole('button',{name:'专注阅读',exact:true}).click();
  await expect(page.locator('.plab-index')).toBeHidden();await expect(page.locator('.plab-rail')).toBeHidden();
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep this note while panels collapse.');
  await page.getByRole('button',{name:'收起笔记',exact:true}).click();
  await expect(page.getByRole('button',{name:'笔记',exact:true})).toBeFocused();
  // Reload only after the existing debounced save has reached the cloud.
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.reload();
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.plab-rail')).toBeHidden();
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Keep this note while panels collapse.');
});

test('PAPER-18 mobile tabs work independently of desktop collapsed preferences',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  const tabs=page.getByRole('tablist',{name:'论文工作台面板'});
  await tabs.getByRole('tab',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记')).toBeVisible();
  await page.getByLabel('段落笔记').fill('Mobile note.');
  await tabs.getByRole('tab',{name:'论文库',exact:true}).click();
  await expect(page.getByRole('button',{name:`${paper.title} 3 段 · 已读 0%`,exact:true})).toBeVisible();
  await tabs.getByRole('tab',{name:'阅读',exact:true}).click();
  await expect(page.getByRole('region',{name:'论文正文',exact:true})).toBeVisible();
  await page.setViewportSize({width:1024,height:900});
  await expect(page.locator('.plab-index')).toBeHidden();
  await expect(page.locator('.plab-rail')).toBeHidden();
  await page.getByRole('button',{name:'笔记',exact:true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Mobile note.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
});
