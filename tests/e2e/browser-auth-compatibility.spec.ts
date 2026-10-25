import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks,type MockProject} from './helpers';

test.setTimeout(120000);
const owner='41000000-0000-4000-8000-000000000001',now='2026-10-25T00:00:00.000Z';
const project:MockProject={id:'42000000-0000-4000-8000-000000000001',user_id:owner,access_role:'owner',title:'兼容性验证研究',kind:'paper',status:'active',metadata:{notes:'仅用于隔离浏览器检查。'},created_at:now,updated_at:now};
for(const signedIn of [false,true])for(const width of [1440,390])test(`account surfaces ${signedIn?'member':'guest'} ${width}px`,async({page},info)=>{
 await page.setViewportSize({width,height:width===390?844:1000});await page.emulateMedia({reducedMotion:'reduce'});
 const state=await installApiMocks(page,{signedIn,userId:owner,projects:signedIn?[project]:[]});
 await page.route('**/api/projects/workbench**',route=>route.fulfill({json:{project,events:[],access:{role:'owner',ownerId:owner,shared:false}}}));
 const errors:string[]=[];page.on('pageerror',error=>errors.push(`${page.url()}: ${error.stack??error.message}`));
 for(const [route,title] of [['/dashboard','总览'],['/courses','课程中心'],['/papers','论文研究'],['/data','数据分析'],['/projects','项目空间'],['/settings','设置']]){
  await page.goto(route);await expect(page.getByRole('heading',{name:title,exact:true,level:1})).toBeVisible();await expect(page.locator('.sidebar-profile-link')).toContainText(signedIn?'测试同学':'未登录');
  if(route==='/dashboard')await expect(page.locator('.overview-footer')).toContainText(signedIn?'student@example.com':'未登录');
  if(route==='/projects'){
   if(signedIn){await expect(page.getByRole('heading',{name:project.title,exact:true})).toBeVisible();await page.getByRole('tab',{name:'方法与检验',exact:true}).click();await expect(page.getByRole('region',{name:'研究设计与统计规划',exact:true})).toBeVisible();}
   else{await expect(page.getByRole('heading',{name:'登录后查看项目',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'新建项目',exact:true})).toBeDisabled();}
  }
  if(route==='/settings'){
   if(signedIn)await expect(page.getByRole('textbox',{name:'昵称',exact:true})).toHaveValue('测试同学');
   else await expect(page.getByRole('heading',{name:'登录后管理个人资料',exact:true})).toBeVisible();
  }
  if(route==='/data'){
   await page.getByText('保存快照与导出复现包',{exact:true}).click();await page.getByText('本机 Python / R 执行与环境锁',{exact:true}).click();await expect(page.getByRole('textbox',{name:'本机会话令牌',exact:true})).toBeVisible();await expect(page.getByText('项目标识不正确。',{exact:true})).toHaveCount(0);
  }
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  if(route==='/projects'){
   const accessibility=await new AxeBuilder({page}).include('.project-main').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations).toEqual([]);
   await mkdir('outputs/browser-auth-audit',{recursive:true});await page.screenshot({path:`outputs/browser-auth-audit/${info.project.name}-${signedIn?'member':'guest'}-${width}.png`,animations:'disabled'});
  }
 }
 expect(errors).toEqual([]);expect(state.requests.filter(item=>/^(POST|PATCH|PUT|DELETE) /.test(item))).toEqual([]);
});

test('password login, reveal, refresh and logout preserve the intended session UI',async({page})=>{
 const state=await installApiMocks(page);await page.goto('/auth');await page.getByLabel('邮箱地址').fill('student@example.com');await page.locator('#account-password').fill('ValidPass1');await page.getByRole('button',{name:'显示密码',exact:true}).click();await expect(page.locator('#account-password')).toHaveAttribute('type','text');await page.getByRole('button',{name:'隐藏密码',exact:true}).click();await expect(page.locator('#account-password')).toHaveAttribute('type','password');await page.getByRole('button',{name:'登录账户',exact:true}).click();await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('.overview-footer')).toContainText('student@example.com');await page.reload();await expect(page.locator('.overview-footer')).toContainText('student@example.com');await page.getByRole('button',{name:'退出',exact:true}).click();await expect(page.locator('.overview-footer')).toContainText('未登录');expect(state.signedIn).toBe(false);
});

test('another tab logout clears old dashboard and profile surfaces',async({context})=>{
 const source=await context.newPage(),dashboard=await context.newPage(),settings=await context.newPage();
 const a=await installApiMocks(source,{signedIn:true,userId:owner,projects:[project]}),b=await installApiMocks(dashboard,{signedIn:true,userId:owner,projects:[project]}),c=await installApiMocks(settings,{signedIn:true,userId:owner});
 await source.goto('/dashboard');await dashboard.goto('/dashboard');await settings.goto('/settings');await expect(dashboard.getByRole('link',{name:new RegExp(project.title)})).toBeVisible();await expect(settings.getByRole('textbox',{name:'昵称',exact:true})).toHaveValue('测试同学');
 b.signedIn=false;c.signedIn=false;await source.getByRole('button',{name:'退出',exact:true}).click();expect(a.signedIn).toBe(false);
 await expect(dashboard.getByRole('link',{name:new RegExp(project.title)})).toHaveCount(0);await expect(dashboard.locator('.overview-footer')).toContainText('未登录');await expect(settings.getByRole('heading',{name:'登录后管理个人资料',exact:true})).toBeVisible();await expect(settings.getByRole('textbox',{name:'昵称',exact:true})).toHaveCount(0);
});

test('storage denied and no BroadcastChannel still revalidate identity on focus',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'BroadcastChannel',{value:undefined});for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Denied','SecurityError');}});});
 const state=await installApiMocks(page,{signedIn:true,userId:owner,projects:[project]});await page.goto('/dashboard');await expect(page.getByRole('link',{name:new RegExp(project.title)})).toBeVisible();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('link',{name:new RegExp(project.title)})).toBeVisible();
 state.signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.locator('.overview-footer')).toContainText('未登录');await expect(page.getByRole('link',{name:new RegExp(project.title)})).toHaveCount(0);
});

test('a late profile save cannot restore a signed-out form or success state',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,userId:owner});let release!:()=>void;const held=new Promise<void>(r=>release=r);let started=false;
 await page.route('**/api/profile',async route=>{if(route.request().method()!=='PUT')return route.fallback();expect(route.request().postDataJSON().expectedOwnerId).toBe(owner);started=true;await held;await route.fulfill({json:{profile:{display_name:'旧账户的延迟保存',preferences:{}}}});});
 try{await page.goto('/settings');await expect(page.getByRole('textbox',{name:'昵称',exact:true})).toHaveValue('测试同学');await page.getByRole('textbox',{name:'昵称',exact:true}).fill('旧账户的延迟保存');await page.getByRole('button',{name:'保存资料',exact:true}).click();await expect.poll(()=>started).toBe(true);state.signedIn=false;await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));await expect(page.getByRole('heading',{name:'登录后管理个人资料',exact:true})).toBeVisible();release();await expect(page.getByText('个人资料已保存。',{exact:true})).toHaveCount(0);await expect(page.getByRole('textbox',{name:'昵称',exact:true})).toHaveCount(0);}finally{release();}
});

test('failed logout keeps account contents and offers an actual error',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,userId:owner,projects:[project]});await page.route('**/api/auth/logout',route=>route.fulfill({status:503,json:{error:'退出未完成，请重试。'}}));await page.goto('/dashboard');await expect(page.getByRole('link',{name:new RegExp(project.title)})).toBeVisible();await page.getByRole('button',{name:'退出',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'退出未完成'})).toBeVisible();await expect(page.locator('.overview-footer')).toContainText('student@example.com');expect(state.signedIn).toBe(true);
});

test('reset-password form is invalidated when the account changes',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,userId:owner});await page.goto('/auth/reset');await expect(page.getByRole('textbox',{name:'新密码',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'新密码',exact:true}).fill('ValidPass1');state.userId='41000000-0000-4000-8000-000000000002';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));await expect(page.getByText('账户已变化，请重新打开重置链接或登录后设置密码。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'保存新密码',exact:true})).toHaveCount(0);expect(state.requests.filter(item=>item==='PUT /api/auth/password')).toEqual([]);
});

test('dashboard rejects a late result when cookies change without a tab signal',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,userId:owner,projects:[project]});let release!:()=>void;const held=new Promise<void>(r=>release=r);let first=true,started=false;
 await page.route('**/api/projects',async route=>{if(first&&route.request().method()==='GET'){first=false;started=true;await held;return route.fulfill({json:{projects:[project]}});}await route.fallback();});
 try{await page.goto('/dashboard');await expect.poll(()=>started).toBe(true);state.userId='41000000-0000-4000-8000-000000000002';state.projects=[];release();await expect(page.getByRole('heading',{name:'还没有论文或项目记录',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:new RegExp(project.title)})).toHaveCount(0);}finally{release();}
});
