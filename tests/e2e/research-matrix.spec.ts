import {expect,test,type Page,type Route} from '@playwright/test';
import {createHash} from 'node:crypto';
import {installApiMocks,type MockProject} from './helpers';
import type {LedgerEvent,RunRecord} from '../../app/lib/research-ledger';
import type {ResearchSnapshot} from '../../app/data/research-history';

test.setTimeout(90000);
const owner='81000000-0000-4000-8000-000000000001',projectId='82000000-0000-4000-8000-000000000001',now='2026-10-25T01:00:00.000Z';
const data={headers:['x','y'],rows:[['0.1','2'],['0.2','4'],['0.4','6'],['0.8','8'],['1.6','11']]};
const sourceHash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
const analysis={kind:'basic' as const,config:{method:'describe',x:'x',y:'y',group:'',value:'x'}};
const project:MockProject={id:projectId,title:'矩阵真实执行验证',kind:'paper',status:'active',metadata:{},created_at:now,updated_at:now};
const specification=(name:string,index:number,column='x'):LedgerEvent=>({id:`83000000-0000-4000-8000-${String(index).padStart(12,'0')}`,entity_id:`84000000-0000-4000-8000-${String(index).padStart(12,'0')}`,sequence:index,revision:index===1?3:1,project_id:projectId,user_id:owner,collection:'specification',archived:false,created_at:now,origin:null,payload:{name,role:index===1?'primary':'robustness',protocolId:'declared-protocol',purpose:'核验真实线程与记录身份',sourceFingerprint:sourceHash,analysis:{...analysis,config:{...analysis.config,x:column}},steps:[]}});
type Write={kind:string;entityId:string;expectedRevision:number;payload:Record<string,unknown>;archived:boolean};
async function setup(page:Page,options:{specs?:LedgerEvent[];snapshot?:ResearchSnapshot;reply?:(route:Route,body:Write,event:LedgerEvent,attempt:number)=>Promise<void>}={}){
 const state=await installApiMocks(page,{signedIn:true,userId:owner,projects:[project]}),events=structuredClone(options.specs??[]),writes:Write[]=[];
 await page.addInitScript(({key,snapshot})=>{if(snapshot)localStorage.setItem(key,JSON.stringify([snapshot]));const Native=window.Worker;Object.defineProperty(window,'__researchWorkerCount',{value:0,writable:true});window.Worker=class extends Native{constructor(url:URL|string,options?:WorkerOptions){super(url,options);if(options?.name==='acaora-research-execution')(window as unknown as {__researchWorkerCount:number}).__researchWorkerCount++;}};},{key:`acaora.datalab.history.v1:${owner}`,snapshot:options.snapshot});
 await page.route('**/api/projects/workbench**',async route=>{if(route.request().method()==='GET')return route.fulfill({json:{project,events}});const body=route.request().postDataJSON() as Write;writes.push(body);const prior=events.find(e=>e.entity_id===body.entityId),event:LedgerEvent=prior??{id:crypto.randomUUID(),sequence:events.length+1,revision:1,project_id:projectId,user_id:owner,collection:body.kind as LedgerEvent['collection'],entity_id:body.entityId,payload:body.payload,archived:body.archived,created_at:now,origin:null};if(!prior)events.push(event);if(options.reply)return options.reply(route,body,event,writes.length);return route.fulfill({json:{event}});});
 await page.goto(`/data?project=${projectId}${options.snapshot?'&snapshot='+options.snapshot.id:''}`);
 await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'matrix.csv',mimeType:'text/csv',buffer:Buffer.from([data.headers.join(','),...data.rows.map(r=>r.join(','))].join('\n'))});await expect(page.getByText(/已读取 matrix.csv/)).toBeVisible();
 if(options.snapshot){const saved=page.getByRole('region',{name:'已保存分析快照',exact:true}),tools=saved.locator('[data-research-operations]');await tools.locator(':scope > summary').click();await expect(tools.getByRole('region',{name:'完整精度复现核验'})).toBeVisible();return {state,events,writes,tools};}
 await page.getByText('保存快照与导出复现包',{exact:true}).click();const tools=page.locator('[data-research-operations]').first();await tools.locator(':scope > summary').click();await expect(tools.getByRole('button',{name:'登记当前规格',exact:true})).toBeVisible();return {state,events,writes,tools};
}
async function execute(tools:ReturnType<Page['locator']>,names:string[]){for(const name of names)await tools.getByRole('checkbox',{name:new RegExp('^'+name+' ·')}).check();await tools.getByRole('checkbox',{name:'我确认按已登记的设置与步骤执行所选规格，并保存每项成功、失败或取消记录',exact:true}).check();await tools.getByRole('button',{name:'运行所选规格',exact:true}).click();}
const savedRuns=(events:LedgerEvent[])=>events.filter(e=>e.collection==='run').map(e=>e.payload as unknown as RunRecord);

test('real serial matrix records success, failed mapping and source refusal with frozen revision and full precision',async({page})=>{
 const mismatch=specification('其他原表',3);mismatch.payload.sourceFingerprint='f'.repeat(64);
 const {tools,events,writes}=await setup(page,{specs:[specification('主分析',1),specification('缺列检验',2,'absent'),mismatch]});
 await execute(tools,['主分析','缺列检验','其他原表']);await expect.poll(()=>savedRuns(events).length).toBe(3);const runs=savedRuns(events),success=runs.find(r=>r.name==='主分析')!;
 expect(runs.map(r=>[r.name,r.status])).toEqual([['主分析','success'],['缺列检验','failed'],['其他原表','failed']]);expect(success.sample).toBe(false);expect(success.engine).toBe('acaora-stats-v2');expect(Number(success.metrics.find(([name])=>name==='mean')![1])).toBeCloseTo(0.62,14);expect(success.metrics.find(([name])=>name==='n')![1]).toBe('5');expect(success.dataFingerprint).toBe(sourceHash);
 expect(JSON.parse(success.settings)).toMatchObject({specRevision:3,specificationId:specification('主分析',1).entity_id,role:'primary',protocolId:'declared-protocol',analysis,steps:[]});expect(success.settingsHash).toMatch(/^[a-f0-9]{64}$/);expect(runs[1].error).toBeTruthy();expect(runs[2].error).toContain('拒绝执行');expect(runs[2].metrics).toEqual([]);
 expect(JSON.stringify(writes)).not.toContain('"rows"');expect(await page.evaluate(()=>(window as unknown as {__researchWorkerCount:number}).__researchWorkerCount)).toBe(2);
 const ids=await page.locator('[data-research-operations]').evaluateAll(nodes=>nodes.map(node=>node.id));expect(new Set(ids).size).toBe(ids.length);
});

test('lost response and local cleanup failure retry the same run ID without rerunning worker',async({page})=>{
 const {tools,events,writes}=await setup(page,{specs:[specification('重试主分析',1)],reply:async(route,_body,event,attempt)=>route.fulfill({status:attempt===1?503:200,json:attempt===1?{error:'模拟响应丢失'}:{event}})});
 await execute(tools,['重试主分析']);const retry=tools.getByRole('button',{name:/^重试保存 1 项运行记录$/});await expect(retry).toBeEnabled();expect(savedRuns(events)).toHaveLength(1);
 await page.evaluate(()=>{const original=Storage.prototype.removeItem;let fail=true;Storage.prototype.removeItem=function(key:string){if(key.startsWith('acaora.research-runs.v1:')&&fail){fail=false;throw new DOMException('模拟本机删除失败');}return original.call(this,key);};});
 await retry.click();await expect(tools.getByRole('alert')).toContainText('本机待保存副本无法删除');await expect(retry).toBeEnabled();await retry.click();await expect(retry).toHaveCount(0);
 expect(writes).toHaveLength(3);expect(new Set(writes.map(w=>w.entityId)).size).toBe(1);expect(savedRuns(events)).toHaveLength(1);expect(await page.evaluate(()=>(window as unknown as {__researchWorkerCount:number}).__researchWorkerCount)).toBe(1);
});

test('legacy snapshot cannot pass an otherwise matching external result or browser rerun',async({page})=>{
 const snapshot:ResearchSnapshot={format:'acaora-analysis-snapshot',version:1,id:'legacy-snapshot',name:'旧版无基线快照',createdAt:now,analysis,result:{source:'matrix.csv',sample:false,method:'描述统计',context:'历史舍入摘要',metrics:[['均值','0.620']]},dataset:{name:'matrix.csv',rows:5,headers:data.headers,fingerprint:sourceHash,sourceFingerprint:sourceHash},workflow:[],dictionary:[]};
 const {tools,events}=await setup(page,{snapshot});const file={name:'python-results.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({versions:{python:'3.13',numpy:'2.5.4'},verificationIdentity:{engine:'acaora-stats-v2',settingsHash:'a'.repeat(64),dataFingerprint:sourceHash,sourceFingerprint:sourceHash},verificationMetrics:[['n',5],['mean',0.62]]}))};
 await tools.getByLabel('导入 Python / R 结果 JSON',{exact:true}).setInputFiles(file);await expect(tools.getByRole('status').filter({hasText:'核验状态'})).toContainText('无法核验');await tools.getByRole('button',{name:'保存核验记录',exact:true}).click();await expect.poll(()=>events.filter(e=>e.collection==='verification').length).toBe(1);expect(events.find(e=>e.collection==='verification')!.payload.status).toBe('not-verifiable');
 await tools.getByRole('button',{name:'按快照设置在浏览器重跑核验',exact:true}).click();await expect(tools.getByRole('status').filter({hasText:'核验状态'})).toContainText('无法核验');await expect(tools.getByRole('status').filter({hasText:'核验状态'})).toContainText('没有完整精度基线');
 await tools.getByLabel('导入 Python / R 结果 JSON',{exact:true}).setInputFiles({...file,buffer:Buffer.from(JSON.stringify({versions:{python:'3.13'},n:5,mean:0.62}))});await expect(tools.getByRole('alert')).toContainText('verificationIdentity');
});

test('identical specification survives lost response and remount with a deterministic entity ID',async({page})=>{
 const {events,writes,tools}=await setup(page,{reply:async(route,_body,event,attempt)=>route.fulfill({status:attempt===1?503:200,json:attempt===1?{error:'模拟规格响应丢失'}:{event}})});
 async function fillAndRegister(panel:ReturnType<Page['locator']>){await panel.getByRole('textbox',{name:'规格名称',exact:true}).fill('卸载重试规格');await panel.getByRole('textbox',{name:'规格用途',exact:true}).fill('完全相同输入重试不得创建两个条目');await panel.getByRole('button',{name:'登记当前规格',exact:true}).click();}
 await fillAndRegister(tools);await expect(tools.getByRole('button',{name:'重试保存冻结规格',exact:true})).toBeEnabled();expect(events.filter(e=>e.collection==='specification')).toHaveLength(1);
 await page.reload();await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'matrix.csv',mimeType:'text/csv',buffer:Buffer.from([data.headers.join(','),...data.rows.map(r=>r.join(','))].join('\n'))});await expect(page.getByText(/已读取 matrix.csv/)).toBeVisible();await page.getByText('保存快照与导出复现包',{exact:true}).click();const remounted=page.locator('[data-research-operations]').first();await remounted.locator(':scope > summary').click();await fillAndRegister(remounted);
 await expect(remounted.getByRole('status').filter({hasText:'规格已登记'})).toBeVisible();expect(writes).toHaveLength(2);expect(writes[0].entityId).toBe(writes[1].entityId);expect(writes[0].entityId.split('-')[2][0]).toBe('5');expect(events.filter(e=>e.collection==='specification')).toHaveLength(1);
});
