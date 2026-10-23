import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {installApiMocks} from './helpers';

const cases=[
  {name:'overview',route:'/dashboard',selector:'a[aria-labelledby^="workspace-"]',property:'translate'},
  {name:'course-catalog',route:'/courses',selector:'a[aria-label^="选择课程："]',child:'strong',property:'translate'},
  {name:'course-reader',route:'/courses/STAT-201/lesson-1',selector:'.course-navigation-toggle',property:'translate'},
  {name:'paper-library',route:'/papers',selector:'button[aria-label^="打开论文："]',child:'strong',property:'translate'},
  {name:'paper-reader',route:'/papers?view=reader',selector:'button[aria-controls="paper-library"]',property:'translate'},
  {name:'data',route:'/data',selector:'button',button:'导入 / 更换数据',property:'translate'},
  {name:'projects',route:'/projects',selector:'.project-list > button',child:'strong',property:'translate'},
  {name:'settings',route:'/settings',selector:'button',button:'保存资料',property:'translate'},
  {name:'help',route:'/help',selector:'a[href="https://github.com/Ceciliasuki/acaora/issues"]',property:'text-decoration-thickness'},
  {name:'auth',route:'/auth',selector:'.auth-mode-tabs button',property:'box-shadow'},
  {name:'reset',route:'/auth/reset',selector:'.auth-result-page a[href="/auth"]',property:'text-decoration-thickness'},
];
const now='2026-10-23T08:00:00Z';
for(const item of cases) test(`shared hover: ${item.name} responds and restores`,async({page})=>{
  await page.setViewportSize({width:1440,height:950});
  await installApiMocks(page,{signedIn:item.name!=='auth'&&item.name!=='reset',
    cloudPapers:[{id:'hover-paper',title:'Hover example',fileName:'hover.pdf',addedAt:1,updatedAt:1,activeParagraph:0,paragraphs:[{id:'hover-p1',section:'Introduction',page:1,original:'Source text remains selectable and stable.',translation:'',note:'',bookmarked:false,read:false}]}],
    projects:[{id:'hover-project',title:'Hover project',kind:'paper',status:'active',metadata:{tasks:[]},created_at:now,updated_at:now}]});
  await page.goto(item.route);
  const target=(item.button?page.getByRole('button',{name:item.button,exact:true}):page.locator(item.selector)).first();
  await expect(target).toBeVisible({timeout:8000});
  const probe=item.child?target.locator(item.child).first():target;
  const value=()=>probe.evaluate((el,property)=>getComputedStyle(el).getPropertyValue(property),item.property);
  const before=await value();
  await target.hover();
  await expect.poll(value).not.toBe(before);
  await mkdir('outputs/shared-hover',{recursive:true});
  await page.screenshot({path:`outputs/shared-hover/${item.name}.png`});
  await page.mouse.move(0,0);
  await expect.poll(value).toBe(before);
});

test('shared hover leaves reading and input geometry stable and respects reduced motion',async({page})=>{
  await installApiMocks(page,{signedIn:true});
  await page.goto('/papers?view=reader');
  const text=page.locator('[data-original-text]').first();
  await expect(text).toBeVisible();
  const geometry=()=>text.evaluate(el=>{const s=getComputedStyle(el);return [s.translate,s.scale,s.transform,el.textContent];});
  const original=await geometry();
  await text.hover();
  await expect.poll(geometry).toEqual(original);
  const navigation=page.getByRole('button',{name:'跳转位置',exact:true});
  await navigation.hover();
  await expect.poll(()=>navigation.evaluate(el=>{const style=getComputedStyle(el);return [style.translate,style.scale];})).toEqual(['none','none']);
  await page.goto('/data');
  const button=page.getByRole('button',{name:'导入 / 更换数据',exact:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  const still=await button.evaluate(el=>getComputedStyle(el).translate);
  await button.hover();
  await expect.poll(()=>button.evaluate(el=>getComputedStyle(el).translate)).toBe(still);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const disabled=page.getByRole('button',{name:'恢复示例数据',exact:true});
  await expect(disabled).toBeDisabled();
  const disabledPose=await disabled.evaluate(el=>getComputedStyle(el).translate);
  await disabled.hover();
  expect(await disabled.evaluate(el=>getComputedStyle(el).translate)).toBe(disabledPose);
  await page.goto('/settings');
  const field=page.getByLabel('昵称',{exact:true});
  await expect(field).toBeVisible();
  {
    await field.fill('本机输入保持不变');
    const rect=await field.boundingBox();
    await field.hover();
    await expect(field).toHaveValue('本机输入保持不变');
    expect(await field.boundingBox()).toEqual(rect);
  }
});

test('touch devices do not retain spatial hover effects',async({browser,baseURL})=>{
  const context=await browser.newContext({baseURL,viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await installApiMocks(page);
  await page.goto('/data');
  const button=page.getByRole('button',{name:'导入 / 更换数据',exact:true});
  await expect(button).toBeVisible();
  expect(await page.evaluate(()=>matchMedia('(hover:hover) and (pointer:fine)').matches)).toBe(false);
  expect(await button.evaluate(el=>getComputedStyle(el).translate)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await context.close();
});
