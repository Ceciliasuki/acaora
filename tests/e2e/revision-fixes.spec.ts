import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
import {installApiMocks} from './helpers';
import {columnPdf} from './revision-pdf-fixture';
const out='outputs/revision-fixes-2026-10-23',key='acaora.datalab.history.v1:user-e2e';
const snapshot={format:'acaora-analysis-snapshot',version:1,id:'probe',name:'Probe analysis',createdAt:'2026-10-23T00:00:00Z',result:{source:'sample.csv',sample:true,method:'Descriptive',context:'Controlled',metrics:[['N','24']]},analysis:{kind:'basic',config:{method:'describe',x:'x',y:'y',group:'',value:'x'}},dataset:{name:'sample.csv',rows:24,headers:['x','y'],fingerprint:'a'.repeat(64),sourceFingerprint:'a'.repeat(64)},workflow:[],dictionary:[]};
const file={name:'snapshot.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(snapshot))};
test('FIX fifty-page controlled PDF imports through the shared index',async({page})=>{
 await installApiMocks(page);await page.goto('/papers');
 await page.getByLabel('导入英文论文 PDF').setInputFiles({name:'controlled-long.pdf',mimeType:'application/pdf',buffer:columnPdf(50)});
 await expect(page.getByLabel('论文标题')).toHaveValue('Controlled Columns and Numeric Tables',{timeout:20000});
 const text=(await page.locator('[data-original-text]').allTextContents()).join(' ');
 expect(text).toContain('Left line 50-0');expect(text).toContain('Right line 50-2');expect(text).toContain('coefficient is -0.5');expect(text).toContain('well-being');expect(text).not.toContain('Controlled repeating header');
});
test('FIX history refresh retains unsaved interpretation, account switch clears it',async({page,context})=>{
 const state=await installApiMocks(page,{signedIn:true,projects:[{id:'p1',title:'Controlled project',kind:'paper',status:'active',metadata:{notes:''},created_at:snapshot.createdAt,updated_at:snapshot.createdAt}]});
 await page.goto('/data');await page.evaluate(({key,snapshot})=>localStorage.setItem(key,JSON.stringify([snapshot])),{key,snapshot});
 await page.goto('/data?snapshot=probe#history');await page.getByText('关联快照到项目',{exact:true}).click();
 const input=page.getByLabel('分析解释',{exact:true});await input.fill('Unsaved interpretation must survive refresh');
 const other=await context.newPage();await installApiMocks(other,{signedIn:true});await other.goto('/help');
 await other.evaluate(()=>localStorage.setItem('acaora:project-note-draft:v1:other-project','unrelated'));
 await expect(input).toHaveValue('Unsaved interpretation must survive refresh');
 await other.evaluate(({key,snapshot})=>localStorage.setItem(key,JSON.stringify([{...snapshot,name:'Refreshed analysis'}])),{key,snapshot});
 await expect(page.getByRole('region',{name:'已保存分析快照'})).toContainText('Refreshed analysis');
 await expect(input).toHaveValue('Unsaved interpretation must survive refresh');
 state.userId='another-owner';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(input).toHaveCount(0);await expect(page.getByRole('alert').filter({hasText:'此账户在本机没有这份快照'})).toBeVisible();
 await other.close();
});
for(const failure of ['none','backup','main','concurrent'])test(`FIX corrupt history recovery preserves original: ${failure}`,async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.goto('/data');
 await page.evaluate(key=>{localStorage.setItem(key,'{broken');localStorage.setItem('acaora.datalab.history.v1:other-owner','other-private-history');},key);
 await page.goto('/data?snapshot=probe#history');
 const recovery=page.getByRole('region',{name:'损坏历史恢复'}),upload=page.getByLabel('从 JSON 恢复快照',{exact:true});
 await expect(upload).toBeEnabled();
 const download=page.waitForEvent('download');await recovery.getByRole('button',{name:'导出损坏历史原件'}).click();
 expect(await readFile((await (await download).path())!,'utf8')).toBe('{broken');
 await upload.setInputFiles(file);const confirm=recovery.getByRole('button',{name:'确认恢复本机历史'});await expect(confirm).toBeDisabled();
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe('{broken');
 await recovery.getByRole('checkbox').check();
 if(failure==='backup'||failure==='main')await page.evaluate(({key,failure})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if((failure==='backup'&&k.startsWith(`${key}:recovery:`))||(failure==='main'&&k===key))throw new DOMException('Controlled quota failure','QuotaExceededError');return original.call(this,k,v);};},{key,failure});
 if(failure==='concurrent')await page.evaluate(key=>localStorage.setItem(key,'{changed-by-another-tab'),key);
 await confirm.click();
 if(failure==='none'){
  await expect(page.getByRole('status').filter({hasText:'快照已恢复，损坏原件已另存本机'})).toBeVisible();
  const saved=await page.evaluate(key=>({history:JSON.parse(localStorage.getItem(key)!),original:Object.keys(localStorage).filter(k=>k.startsWith(`${key}:recovery:`)).map(k=>localStorage.getItem(k))}),key);
  expect(saved.history[0].id).toBe(snapshot.id);expect(saved.original).toEqual(['{broken']);
  await mkdir(out,{recursive:true});await page.locator('#history').screenshot({path:`${out}/history-restored.png`});
 }else{
  await expect(page.locator('#history [role=alert]').filter({hasText:failure==='concurrent'?'本机历史已经变化':'Controlled quota failure'})).toBeVisible();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(failure==='concurrent'?'{changed-by-another-tab':'{broken');
 }
 expect(await page.evaluate(()=>localStorage.getItem('acaora.datalab.history.v1:other-owner'))).toBe('other-private-history');
});
test('FIX import started in another identity cannot write after account switch',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/data?snapshot=probe#history');
 await expect(page.getByLabel('从 JSON 恢复快照',{exact:true})).toBeEnabled();
 await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){await new Promise<void>(resolve=>window.addEventListener('release-file-read',()=>resolve(),{once:true}));return original.call(this);};});
 await page.getByLabel('从 JSON 恢复快照',{exact:true}).setInputFiles(file);
 state.userId='another-owner';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(page.getByLabel('从 JSON 恢复快照',{exact:true})).toBeEnabled();
 await page.evaluate(()=>window.dispatchEvent(new Event('release-file-read')));
 await expect(page.getByRole('status').filter({hasText:'账户或历史已变化，请重新选择备份'})).toBeVisible();
 expect(await page.evaluate(()=>localStorage.getItem('acaora.datalab.history.v1:another-owner'))).toBeNull();
 expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});
for(const remoteGeneration of [1,2])test(`FIX course resume uses queued position only in current generation ${remoteGeneration}`,async({page})=>{
 const recordKey=JSON.stringify(['user-e2e','STAT-201']);
 const remote={courseId:'STAT-201',generation:remoteGeneration,lastLessonId:'lesson-1',completedLessonIds:[],attempts:[]};
 const state=await installApiMocks(page,{signedIn:true,courseRecords:{[recordKey]:remote}});await page.goto('/courses');
 await expect(page.getByRole('region',{name:'继续学习'})).not.toContainText('正在读取');
 await page.evaluate(async({recordKey,remote})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('acaora-curated-courses',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const t=db.transaction(['snapshots','queue'],'readwrite');t.objectStore('snapshots').put({key:recordKey,ownerId:'user-e2e',snapshot:{...remote,generation:1,lastLessonId:'lesson-2'}});for(const [sequence,lastLessonId] of [[1,'lesson-1'],[2,'lesson-2'],[3,'missing-lesson']] as const)t.objectStore('queue').put({...remote,generation:1,ownerId:'user-e2e',operationId:`pending-${sequence}`,sequence,lastLessonId});t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});db.close();
 },{recordKey,remote});
 await page.reload();const resume=page.getByRole('region',{name:'继续学习'});
 await expect(resume.getByRole('link',{name:'继续学习：概率论与数理统计'})).toHaveAttribute('href',`/courses/STAT-201/lesson-${remoteGeneration===1?'2':'1'}`);
 if(remoteGeneration===1)await expect(resume).toContainText('本机新位置，待同步到账户');else await expect(resume).not.toContainText('本机新位置');
 expect(state.requests.filter(r=>/^(PUT|POST).*courses/.test(r))).toHaveLength(0);
});
for(const width of [1366,375])test(`FIX homepage readable source and note at ${width}px`,async({page})=>{
 await installApiMocks(page);await page.setViewportSize({width,height:width===375?812:768});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 const figure=page.getByRole('figure',{name:'原文与笔记示例'});
 await expect(figure.getByRole('heading',{name:'我的笔记'})).toBeVisible();await expect(figure).toContainText('重点检查是否存在数据泄漏。');
 expect(await figure.locator('blockquote').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 // Element screenshots scroll the page; reset before full-page capture so an
 // off-viewport fixed skip link is not composited inside the long screenshot.
 await mkdir(out,{recursive:true});await figure.screenshot({path:`${out}/home-example-${width}.png`,animations:'disabled'});
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 expect(await page.getByRole('link',{name:'跳到主要内容'}).evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThan(0);
 await page.screenshot({path:`${out}/home-${width}.png`,fullPage:true,animations:'disabled'});
 await figure.getByRole('link',{name:'打开示例工作台，核对原文'}).click();await expect(page.getByLabel('论文标题')).toHaveValue('Statistical learning in observational studies: principles and practice');
});
