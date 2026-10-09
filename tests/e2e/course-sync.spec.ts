import {expect,test,type Request} from '@playwright/test';
import {installApiMocks} from './helpers';

test('SYNC-08 reconnect waits for the returning account local snapshot before syncing',async({page})=>{
 await page.addInitScript(()=>{
  const descriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')!;
  Object.defineProperty(IDBTransaction.prototype,'oncomplete',{
   ...descriptor,
   set(listener:((this:IDBTransaction,event:Event)=>unknown)|null){
    descriptor.set!.call(this,listener?function(this:IDBTransaction,event:Event){
     if(this.mode==='readonly'&&this.objectStoreNames.contains('snapshots')&&document.documentElement.dataset.holdCourseLoad==='yes'){
      document.documentElement.dataset.courseLoadHeld='yes';
      window.addEventListener('course-load-release',()=>{delete document.documentElement.dataset.holdCourseLoad;listener.call(this,event);},{once:true});
     }else listener.call(this,event);
    }:null);
   },
  });
 });
 const state=await installApiMocks(page,{signedIn:true,courseSyncStatus:503});
 await page.goto('/courses/STAT-201/lesson-1');
 await page.getByRole('button',{name:'标记本节已读'}).click();
 await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 state.userId='second-user';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(page.getByRole('button',{name:'标记本节已读'})).toBeEnabled();
 await expect(page.getByText('本机记录已保留，等待云端同步。',{exact:true})).toBeVisible();
 await page.evaluate(()=>{document.documentElement.dataset.holdCourseLoad='yes';});
 state.userId='user-e2e';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect.poll(()=>page.evaluate(()=>document.documentElement.dataset.courseLoadHeld)).toBe('yes');
 let reads=0;
 page.on('request',request=>{if(request.method()==='GET'&&request.url().endsWith('/api/courses/STAT-201/progress'))reads++;});
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForTimeout(250);
 expect(reads,'cloud sync must wait while the returning account local snapshot is loading').toBe(0);
 await page.evaluate(()=>window.dispatchEvent(new Event('course-load-release')));
 await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
});

test('SYNC-01 separate browser stores merge different lessons and restore attempts',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();
 try {
  const pa=await a.newPage(),pb=await b.newPage();const sa=await installApiMocks(pa,{signedIn:true}),sb=await installApiMocks(pb,{signedIn:true});sb.courseRecords=sa.courseRecords;
  await pa.goto('/courses/STAT-201/lesson-1');await pb.goto('/courses/STAT-201/lesson-2');
  await pa.getByRole('button',{name:'标记本节已读'}).click();await pb.getByRole('button',{name:'标记本节已读'}).click();
  const q=pa.locator('[aria-labelledby="title-STAT-201-l1-q3"]');await q.getByLabel('输入数值答案').fill('0.6');await q.getByRole('button',{name:'检查答案'}).click();
  const key=JSON.stringify([sa.userId,'STAT-201']);await expect.poll(()=>sa.courseRecords[key]?.completedLessonIds.slice().sort()).toEqual(['lesson-1','lesson-2']);await expect.poll(()=>sa.courseRecords[key]?.attempts.length).toBe(1);
  await pb.goto('/courses/STAT-201/lesson-1');await expect(pb.getByText('本节已读',{exact:true})).toBeVisible();await expect(pb.locator('[aria-labelledby="title-STAT-201-l1-q3"]').getByLabel('输入数值答案')).toHaveValue('0.6');
 }finally{await a.close();await b.close();}
});

test('SYNC-02 disconnected work survives refreshed page when cloud remains unavailable, then retries',async({page,context})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses/FIN-308/lesson-8');const q=page.locator('[aria-labelledby="title-FIN-308-l8-q2"]');await q.getByLabel('输入数值答案').fill('355000');
 // Playwright route.fulfill bypasses the real offline network, so abort the
 // mocked endpoint explicitly while the context is disconnected.
 await page.route('**/api/courses/FIN-308/progress',route=>route.abort('internetdisconnected'));
 await context.setOffline(true);await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');await expect(page.getByText('云端记录暂未读取成功，本机记录已保留。',{exact:true})).toBeVisible();
 state.courseSyncStatus=503;await context.setOffline(false);await page.unroute('**/api/courses/FIN-308/progress');
 // The online event can finish an old document's PUT during reload. Only the
 // refreshed document's failed upload proves its durable queue was restored.
 let reloadStarted=false;const reloadRequests=new Set<Request>();
 const trackReload=(request:Request)=>{
  if(request.isNavigationRequest()&&request.url().endsWith('/courses/FIN-308/lesson-8'))reloadStarted=true;
  if(reloadStarted)reloadRequests.add(request);
 };
 page.on('request',trackReload);
 const unavailable=page.waitForResponse(response=>reloadRequests.has(response.request())&&response.url().endsWith('/api/courses/FIN-308/progress')&&response.request().method()==='PUT'&&response.status()===503);
 await page.reload();await unavailable;await expect(q.getByLabel('输入数值答案')).toHaveValue('355000');await expect(page.getByText('本机记录已保留，等待云端同步。',{exact:true})).toBeVisible();
 page.off('request',trackReload);
 // Restore the mock service when the retry is actually clicked. Restoring it
 // earlier allows an automatic upload to remove the button before this click.
 await page.exposeFunction('restoreCourseSync',()=>{state.courseSyncStatus=200;});
 await page.evaluate(()=>document.addEventListener('click',()=>{
  void (window as unknown as {restoreCourseSync:()=>Promise<void>}).restoreCourseSync();
 },{capture:true,once:true}));
 await page.getByRole('button',{name:'重试同步'}).click();await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'FIN-308'])]?.attempts.some(x=>x.answer==='355000')).toBe(true);
});

test('SYNC-03 reset on another device prevents a stale durable queue restoring old progress',async({browser})=>{
 const a=await browser.newContext(),b=await browser.newContext();
 try {
  const pa=await a.newPage(),pb=await b.newPage();const sa=await installApiMocks(pa,{signedIn:true,courseSyncStatus:503}),sb=await installApiMocks(pb,{signedIn:true});sb.courseRecords=sa.courseRecords;
  await pa.goto('/courses/STAT-201/lesson-1');await pa.getByRole('button',{name:'标记本节已读'}).click();await expect(pa.getByText('本节已读',{exact:true})).toBeVisible();
  await pb.goto('/courses/STAT-201');await pb.getByText('学习记录',{exact:true}).click();await pb.getByRole('button',{name:'重置本课程进度'}).click();await pb.getByRole('button',{name:'确认重置本课程'}).click();
  const key=JSON.stringify([sa.userId,'STAT-201']);await expect.poll(()=>sa.courseRecords[key]?.generation).toBe(2);
  sa.courseSyncStatus=200;await pa.getByRole('button',{name:'重试同步'}).click();await expect(pa.getByRole('button',{name:'标记本节已读'})).toBeVisible();await pa.reload();await expect(pa.getByRole('button',{name:'标记本节已读'})).toBeVisible();expect(sa.courseRecords[key].completedLessonIds).toEqual([]);
 }finally{await a.close();await b.close();}
});

test('SYNC-04 mismatched question versions are flagged for review rather than accepted as mastery',async({page})=>{
 const snapshot={courseId:'STAT-201',generation:1,completedLessonIds:[],lastLessonId:null,attempts:[{id:'b804b6bb-2b2c-4490-b8be-0b4c83df6ab3',questionId:'STAT-201-l1-q3',questionVersion:2,answer:'0.6',viewedSolution:false,createdAt:1}]};
 await installApiMocks(page,{signedIn:true,courseRecords:{[JSON.stringify(['user-e2e','STAT-201'])]:snapshot}});await page.goto('/courses/STAT-201/review');await expect(page.getByRole('heading',{name:'题目已更新，需重新作答'})).toBeVisible();await expect(page.getByRole('link',{name:'回到题目'})).toHaveAttribute('href','/courses/STAT-201/lesson-1#title-STAT-201-l1-q3');
});

test('SYNC-05 retry reads the cloud even when no local operations exist',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,courseReadStatus:503});await page.goto('/courses/STAT-201');
 await expect(page.getByRole('button',{name:'重试同步'})).toBeVisible();
 const before=state.requests.filter(x=>x==='GET /api/courses/STAT-201/progress').length;
 await page.getByRole('button',{name:'重试同步'}).click();
 await expect.poll(()=>state.requests.filter(x=>x==='GET /api/courses/STAT-201/progress').length).toBeGreaterThan(before);
 await expect(page.getByRole('button',{name:'重试同步'})).toBeVisible();state.courseReadStatus=200;
 await page.getByRole('button',{name:'重试同步'}).click();await expect(page.getByText('学习记录已同步',{exact:true})).toBeVisible();
});

test('SYNC-06 a failed reset retries the same generation without reviving old records',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,courseSyncStatus:503});await page.goto('/courses/STAT-201');
 await page.getByText('学习记录',{exact:true}).click();await page.getByRole('button',{name:'重置本课程进度'}).click();await page.getByRole('button',{name:'确认重置本课程'}).click();
 await expect(page.getByText('重置尚未确认成功，请重试；本机记录已保留。',{exact:true})).toBeVisible();
 const failed=page.waitForResponse(r=>r.url().endsWith('/api/courses/STAT-201/progress')&&r.request().method()==='POST'&&r.status()===503);await page.reload();await failed;
 await expect(page.getByText('重置尚未确认成功，请重试；本机记录已保留。',{exact:true})).toBeVisible();state.courseSyncStatus=200;
 await page.getByRole('button',{name:'重试同步'}).click();
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.generation).toBe(2);
 expect(state.requests.filter(x=>x==='POST /api/courses/STAT-201/progress')).toHaveLength(3);
});

test('SYNC-07 durable navigation uses sequence rather than UUID order',async({page})=>{
 await page.addInitScript(()=>{crypto.randomUUID=()=>location.pathname.endsWith('lesson-1')?'ffffffff-ffff-4fff-8fff-ffffffffffff':'11111111-1111-4111-8111-111111111111';});
 const state=await installApiMocks(page,{signedIn:true,courseSyncStatus:503});await page.goto('/courses/STAT-201/lesson-1');
 await expect(page.getByText('本机记录已保留，等待云端同步。',{exact:true})).toBeVisible();await page.goto('/courses/STAT-201/lesson-2');
 await expect(page.getByText('本机记录已保留，等待云端同步。',{exact:true})).toBeVisible();
 state.courseSyncStatus=200;await page.getByRole('button',{name:'重试同步'}).click();
 await expect(page.getByText('学习记录已同步',{exact:true})).toBeVisible();expect(state.courseRecords[JSON.stringify([state.userId,'STAT-201'])].lastLessonId).toBe('lesson-2');
});
