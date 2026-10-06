import {expect, test} from '@playwright/test';
import {installApiMocks} from './helpers';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const paper = {
  id:'loading-paper', title:'Local reading while cloud is slow', fileName:'loading.pdf',
  addedAt:1, updatedAt:1, activeParagraph:0,
  paragraphs:[{id:'loading-paragraph',page:1,section:'Introduction',original:'An existing local paper remains readable while the cloud request is pending.',translation:'',note:'',read:false,bookmarked:false}],
};

test('LOAD-01 page and sidebar share concurrent session reads', async ({page}) => {
  const state = await installApiMocks(page,{signedIn:true});
  await page.route('**/api/auth/session',async route=>{
    await new Promise(resolve=>setTimeout(resolve,250));
    await route.fallback();
  });
  await page.goto('/dashboard');
  await expect(page.locator('.sidebar-profile-link')).toContainText('测试同学');
  await expect(page.getByRole('status',{name:'正在读取工作台记录'})).toHaveCount(0);
  expect(state.requests.filter(request=>request==='GET /api/auth/session')).toHaveLength(1);
});

test('LOAD-02 a confirmed owner can read and edit the local paper before cloud returns', async ({page}) => {
  const state = await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  await page.goto('/data');
  let release!:()=>void;
  const held = new Promise<void>(resolve=>{release=resolve;});
  let cloudStarted=false;
  await page.route('**/api/cloud/papers',async route=>{
    if(route.request().method()==='GET'){cloudStarted=true;await held;}
    await route.fallback();
  });
  try {
    await page.goto('/papers');
    await expect.poll(()=>cloudStarted).toBe(true);
    await expect(page.getByLabel('论文标题')).toHaveValue(paper.title,{timeout:1200});
    await expect(page.getByRole('region',{name:'论文正文'})).toContainText(paper.paragraphs[0].original);
    await page.getByRole('button',{name:'笔记',exact:true}).click();
    await page.getByLabel('段落笔记').fill('An edit made before the cloud response.');
    // Release before the usual 450ms save, so a late cloud snapshot meets a draft.
    release();
    await expect(page.getByLabel('段落笔记')).toHaveValue('An edit made before the cloud response.');
    await expect.poll(()=>state.requestBodies.some(body=>(body as typeof paper).paragraphs?.[0]?.note==='An edit made before the cloud response.')).toBe(true);
    await page.reload();
    await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
    await page.getByRole('button',{name:'笔记',exact:true}).click();
    await expect(page.getByLabel('段落笔记')).toHaveValue('An edit made before the cloud response.');
  } finally {release();}
});

test('LOAD-03 failed cloud refresh keeps the confirmed owner local paper usable', async ({page})=>{
  await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.goto('/data');
  await page.route('**/api/cloud/papers',async route=>{
    if(route.request().method()==='GET')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary cloud outage'})});
    await route.fallback();
  });
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('同步暂不可用');
});

test('LOAD-04 settings account fields do not wait for model metadata', async ({page})=>{
  await installApiMocks(page,{signedIn:true});
  let release!:()=>void;
  const held = new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/papers/ai',async route=>{await held;await route.fallback();});
  try {
    await page.goto('/settings');
    await expect(page.getByLabel('昵称',{exact:true})).toHaveValue('测试同学',{timeout:1200});
    await expect(page.getByText('正在读取服务端模型配置…',{exact:false})).toBeVisible();
  } finally {release();}
});

test('LOAD-05 a late initial cloud response cannot restore the previous account paper', async ({page})=>{
  const state = await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  let release!:()=>void;
  const held = new Promise<void>(resolve=>{release=resolve;});
  let first=true, started=false;
  await page.route('**/api/cloud/papers',async route=>{
    if(first && route.request().method()==='GET') {
      first=false;started=true;await held;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({papers:[paper],deletions:[]})});
    }
    await route.fallback();
  });
  try {
    await page.goto('/papers');
    await expect.poll(()=>started).toBe(true);
    state.signedIn=false;
    await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
    await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('设备端保存');
    release();
    await expect(page.getByLabel('论文标题')).not.toHaveValue(paper.title);
    await expect(page.getByRole('region',{name:'论文正文'})).toBeVisible();
  } finally {release();}
});

test('LOAD-06 a cloud deletion takes precedence over a draft made during refresh', async ({page})=>{
  await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
  await page.goto('/data');
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  let started=false;
  await page.route('**/api/cloud/papers',async route=>{
    if(route.request().method()==='GET'){
      started=true;await held;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({papers:[],deletions:[{id:paper.id,deletedAt:Date.now()}]})});
    }
    await route.fallback();
  });
  try {
    await page.goto('/papers');
    await expect.poll(()=>started).toBe(true);
    await expect(page.getByLabel('论文标题')).toHaveValue(paper.title);
    await page.getByRole('button',{name:'笔记',exact:true}).click();
    await page.getByLabel('段落笔记').fill('Draft while a cloud deletion is pending.');
    release();
    await expect(page.getByLabel('论文标题')).not.toHaveValue(paper.title);
    await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('已同步');
  }finally{release();}
});

test('LOAD-07 applying an old cloud snapshot preserves a newer committed local note and queue',async({page})=>{
  await installApiMocks(page);
  const storageSource=readFileSync('app/papers/paper-storage.ts','utf8');
  const storageScript=ts.transpileModule(storageSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  await page.route('**/test/paper-storage.js',route=>route.fulfill({contentType:'application/javascript',body:storageScript}));
  await page.route('**/test/paper-sync.mjs',route=>route.fulfill({contentType:'application/javascript',body:readFileSync('app/papers/paper-sync.mjs','utf8')}));
  await page.goto('/data');
  const result=await page.evaluate(async record=>{
    const modulePath='/test/paper-storage.js';
    const storage=await import(modulePath);
    const owned={...record,ownerId:'storage-race-owner'};
    await storage.savePaper(owned);
    const oldSnapshot=await storage.getPaperLibrary(owned.ownerId);
    const newer={...owned,updatedAt:2,paragraphs:[{...owned.paragraphs[0],note:'New committed note'}]};
    await storage.savePaperAndQueue(newer);
    await storage.applyPaperSyncSnapshot(owned.ownerId,oldSnapshot,[]);
    return {note:(await storage.getPaperLibrary(owned.ownerId))[0].paragraphs[0].note,queued:(await storage.getPaperSyncOperations(owned.ownerId)).map((op: {paper?:typeof newer})=>op.paper?.paragraphs[0].note)};
  },paper);
  expect(result).toEqual({note:'New committed note',queued:['New committed note']});
});

test('LOAD-08 failed session recheck does not leave initial reading skeleton forever',async({page})=>{
  await installApiMocks(page,{signedIn:true,cloudPapers:[paper]});
  let release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  let started=false;
  await page.route('**/api/cloud/papers',async route=>{started=true;await held;await route.fallback();});
  try {
    await page.goto('/papers');
    await expect.poll(()=>started).toBe(true);
    await page.route('**/api/auth/session',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Session unavailable'})}));
    await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
    await expect(page.locator('.paper-layout-controls [role="status"]')).toHaveText('同步暂不可用');
    await expect(page.getByRole('region',{name:'论文正文'})).toBeVisible();
  }finally{release();}
});

test('LOAD-09 an already queued existing-paper save cannot recreate a cloud-deleted paper',async({page})=>{
  await installApiMocks(page);
  const source=readFileSync('app/papers/paper-storage.ts','utf8');
  await page.route('**/test/paper-storage.js',route=>route.fulfill({contentType:'application/javascript',body:ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText}));
  await page.route('**/test/paper-sync.mjs',route=>route.fulfill({contentType:'application/javascript',body:readFileSync('app/papers/paper-sync.mjs','utf8')}));
  await page.goto('/data');
  const result=await page.evaluate(async record=>{
    const modulePath='/test/paper-storage.js',storage=await import(modulePath);
    const owned={...record,ownerId:'queued-deletion-owner'};
    await storage.savePaper(owned);
    const merging=storage.applyPaperSyncSnapshot(owned.ownerId,[],[{id:owned.id,deletedAt:3}]);
    const saving=storage.savePaperAndQueue({...owned,updatedAt:2},{requireExisting:true});
    await merging;const saved=await saving;
    return {saved,papers:await storage.getPaperLibrary(owned.ownerId),pending:await storage.getPaperSyncOperations(owned.ownerId)};
  },paper);
  expect(result).toEqual({saved:false,papers:[],pending:[]});
});
