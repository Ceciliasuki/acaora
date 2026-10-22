import {expect, test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks, type MockProject} from './helpers';

const now = '2026-10-14T08:00:00.000Z';
const project: MockProject = {id:'craft-project', title:'文献整理与研究计划', kind:'paper', status:'active', metadata:{goal:'核对文献来源，整理下一步任务。',notes:'先检查证据，再记录判断。',tasks:[{id:'task-one',text:'核对引用来源',done:false}]},created_at:now,updated_at:now};
const captures = 'outputs/workspace-audit-2026-10-14';

test('Desktop workspace evidence with controlled records', async ({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.emulateMedia({reducedMotion:'reduce'});
  await mkdir(captures,{recursive:true});
  for (const route of ['projects','settings']) {
    await page.setViewportSize({width:1440,height:900});
    await page.goto(`/${route}`);
    if(route==='projects') await expect(page.getByRole('heading',{name:project.title,exact:true})).toBeVisible();
    else await expect(page.getByLabel('昵称',{exact:true})).toHaveValue('测试同学');
    await page.screenshot({path:`${captures}/${route}-controlled-${process.env.CRAFT_CAPTURE_PHASE ?? 'after'}.png`});
  }
});

test('Data method tabs and the account tabs activate with keyboard and expose their panels', async ({page})=>{
  await installApiMocks(page);
  await page.goto('/data');
  const tabs = page.getByRole('tablist',{name:'分析方法',exact:true});
  await tabs.getByRole('tab',{name:'描述统计',exact:true}).press('ArrowRight');
  await expect(tabs.getByRole('tab',{name:'相关与回归',exact:true})).toBeFocused();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','analysis-tab-relation');
  await page.keyboard.press('End');
  await expect(tabs.getByRole('tab',{name:'进阶方法',exact:true})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Home');
  await expect(tabs.getByRole('tab',{name:'描述统计',exact:true})).toHaveAttribute('tabindex','0');
  await page.goto('/auth');
  await page.getByRole('tab',{name:'密码登录',exact:true}).press('ArrowRight');
  await expect(page.getByRole('tab',{name:'注册账户',exact:true})).toBeFocused();
  await expect(page.getByLabel('昵称',{exact:true})).toBeVisible();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby','account-tab-register');
});

test('Course studio keeps collapsible directories and reading drafts across layouts', async ({page})=>{
  await installApiMocks(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  await mkdir('outputs/course-ui-2026-10-22',{recursive:true});
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/courses');
  const trigger=page.getByRole('button',{name:'课程目录',exact:true});
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  const course=page.getByRole('button',{name:'STAT-302 回归分析',exact:true});
  await expect(course).toBeHidden();
  await expect(page.locator('.course-navigation-rail')).toHaveCSS('width','56px');
  await trigger.hover();
  await expect(course).toBeVisible();await course.click();
  await expect(page.getByRole('heading',{name:'回归分析',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'课程中心',exact:true}).click();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(course).toBeHidden();
  // The course rows are links with a tint and arrow, without browser underlines.
  const firstLesson=page.locator('.course-lesson-link').first();
  await expect(firstLesson).toHaveCSS('text-decoration-line','none');
  await page.screenshot({path:'outputs/course-ui-2026-10-22/catalog-1440.png'});
  await page.setViewportSize({width:1024,height:900});
  await expect(course).toBeHidden();
  await expect(trigger).toBeVisible();
  await page.screenshot({path:'outputs/course-ui-2026-10-22/catalog-1024.png'});
  await page.setViewportSize({width:375,height:900});
  await expect(trigger).toBeVisible();
  await page.getByRole('heading',{name:'课程中心',exact:true}).click();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(course).toBeHidden();
  await trigger.click();await expect(course).toBeVisible();
  await trigger.press('Escape');await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await page.screenshot({path:'outputs/course-ui-2026-10-22/catalog-375.png'});
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
  expect(size.scroll).toBeLessThanOrEqual(size.width+1);
  // Click-to-pin remains available on smaller screens.
  await trigger.click();await expect(trigger).toHaveAttribute('aria-expanded','true');
  await trigger.click(); await expect(trigger).toHaveAttribute('aria-expanded','false');
  // A draft stays mounted when focus mode changes the reading composition.
  await page.goto('/courses/STAT-201/lesson-1');
  const draft=page.getByLabel('输入数值答案').first();await draft.fill('0.6');
  await page.getByRole('button',{name:'专注阅读',exact:true}).click();
  await expect(draft).toHaveValue('0.6');
  await page.getByRole('button',{name:/退出专注/}).press('Escape');
  await expect(draft).toHaveValue('0.6');
  await page.goto('/courses/STAT-201/lesson-1');
  await page.screenshot({path:'outputs/course-ui-2026-10-22/lesson-375.png'});
  await page.setViewportSize({width:1440,height:900});
  await expect(page.getByRole('link',{name:'条件概率与独立',exact:true})).toBeHidden();
  await page.getByRole('button',{name:'章节导航',exact:true}).hover();
  await expect(page.getByRole('link',{name:'条件概率与独立',exact:true})).toBeVisible();
  await page.getByRole('heading',{name:'概率论与数理统计',exact:true}).click();
  await expect(page.getByRole('link',{name:'条件概率与独立',exact:true})).toBeHidden();
  await page.screenshot({path:'outputs/course-ui-2026-10-22/lesson-1440.png'});
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
});

test('Failed project writes preserve drafts and an in-flight write cannot be duplicated', async ({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project]});
  let writes=0;
  await page.route('**/api/projects?*',async route=>{
    if(route.request().method()!=='PATCH') return route.fallback();
    writes++;
    await new Promise(resolve=>setTimeout(resolve,250));
    if(writes===1) return route.fulfill({status:503,json:{error:'保存暂时不可用，请重试。'}});
    await route.fallback();
  });
  await page.goto('/projects');
  const field=page.getByLabel('新任务',{exact:true});
  await field.fill('保留这条待办');
  await page.getByRole('button',{name:'添加',exact:true}).click();
  await expect(page.getByLabel('项目状态',{exact:true})).toBeDisabled();
  await expect(page.locator('.project-tasks input')).toBeDisabled();
  await expect(page.locator('.project-message[role="alert"]')).toContainText('保存暂时不可用');
  await expect(field).toHaveValue('保留这条待办');
  await page.getByRole('button',{name:'添加',exact:true}).click();
  await field.fill('继续记录的下一条');
  await expect(page.locator('.project-tasks')).toContainText('保留这条待办');
  await expect(field).toHaveValue('继续记录的下一条');
  expect(writes).toBe(2);
});

test('Task and note drafts belong to their project when switching records', async ({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project,{...project,id:'other',title:'第二个项目',metadata:{tasks:[]}}]});
  await page.goto('/projects');
  await page.getByLabel('新任务',{exact:true}).fill('第一条草稿');
  await page.getByLabel('项目笔记',{exact:true}).fill('尚未保存的研究思路');
  await page.locator('.project-list').getByRole('button',{name:/第二个项目/}).click();
  await expect(page.getByLabel('新任务',{exact:true})).toHaveValue('');
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue('');
  await page.locator('.project-list').getByRole('button',{name:/文献整理与研究计划/}).click();
  await expect(page.getByLabel('新任务',{exact:true})).toHaveValue('第一条草稿');
  await expect(page.getByLabel('项目笔记',{exact:true})).toHaveValue('尚未保存的研究思路');
  await expect(page.getByText('有未保存修改',{exact:true})).toBeVisible();
});

test('Project creation and deletion failures stay visible inside their dialog', async ({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.route('**/api/projects**',async route=>{
    if(['POST','DELETE'].includes(route.request().method())) return route.fulfill({status:503,json:{error:'暂时无法提交，请重试。'}});
    await route.fallback();
  });
  await page.goto('/projects');
  await page.getByRole('button',{name:'新建项目',exact:true}).click();
  await page.getByLabel('项目名称',{exact:true}).fill('输入应保留');
  await page.getByRole('button',{name:'创建项目空间',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('暂时无法提交');
  await expect(page.getByLabel('项目名称',{exact:true})).toHaveValue('输入应保留');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'删除',exact:true}).click();
  await page.getByRole('button',{name:'确认删除',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'删除这个项目？'}).getByRole('alert')).toContainText('暂时无法提交');
  await expect(page.getByRole('button',{name:'确认删除',exact:true})).toBeEnabled();
});

test('Settings report rejected metadata and blocked session storage without claiming a save', async ({page})=>{
  await installApiMocks(page,{signedIn:true});
  await page.route('**/api/version',route=>route.fulfill({status:503,json:{commit:'invalid'}}));
  await page.route('**/api/papers/ai',route=>route.fulfill({status:503,json:{model:'unconfirmed'}}));
  await page.goto('/settings');
  await expect(page.getByText('暂时无法读取版本',{exact:true})).toBeVisible();
  await expect(page.locator('#ai-models')).toContainText('配置请求失败');
  await page.getByLabel('DeepSeek API Key',{exact:true}).fill('test-only-not-a-real-key');
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked','QuotaExceededError');};});
  await page.getByRole('button',{name:'保存到当前会话',exact:true}).click();
  await expect(page.locator('.workspace-feedback').getByRole('alert')).toContainText('无法保存会话设置');
  await expect(page.getByLabel('DeepSeek API Key',{exact:true})).toHaveValue('test-only-not-a-real-key');
  await expect(page.locator('.workspace-feedback').getByRole('alert')).toBeInViewport();
});

test('Data section navigation preserves selection and can reveal every imported variable', async ({page})=>{
  await installApiMocks(page);
  await page.goto('/data');
  const csv=Array.from({length:10},(_,i)=>`variable_${i}`).join(',')+'\n'+Array.from({length:10},(_,i)=>i+1).join(',')+'\n'+Array.from({length:10},(_,i)=>i+2).join(',');
  await page.getByLabel('选择数据文件',{exact:true}).setInputFiles({name:'controlled-ui.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect(page.getByRole('status')).toContainText('刷新后需重新选择原文件');
  await page.getByRole('navigation',{name:'数据分析分区',exact:true}).getByRole('link',{name:'变量检查',exact:true}).click();
  await expect(page.locator('#quality > details')).toHaveAttribute('open');
  await expect(page.locator('.variable-card')).toHaveCount(8);
  await page.getByRole('button',{name:'查看全部 10 个变量',exact:true}).click();
  await expect(page.locator('.variable-card')).toHaveCount(10);
  await page.getByRole('navigation',{name:'数据分析分区',exact:true}).getByRole('link',{name:'分析结果',exact:true}).click();
  await expect(page.locator('#analysis')).toBeInViewport();
  await page.getByRole('tab',{name:'描述统计',exact:true}).press('ArrowRight');
  await page.getByRole('navigation',{name:'数据分析分区',exact:true}).getByRole('link',{name:'处理表预览',exact:true}).click();
  await expect(page.getByRole('tab',{name:'相关与回归',exact:true})).toHaveAttribute('aria-selected','true');
});

test('The public create-account entry opens registration directly', async ({page})=>{
  await installApiMocks(page);
  await page.goto('/');
  await page.getByRole('link',{name:'创建账户',exact:true}).click();
  await expect(page.getByRole('tab',{name:'注册账户',exact:true})).toHaveAttribute('aria-selected','true');
  await expect(page.getByLabel('昵称',{exact:true})).toBeVisible();
});

for(const width of [1024,1440]) test(`Desktop cross-page layout and accessibility at ${width}px @a11y`,async ({page})=>{
  await installApiMocks(page,{signedIn:true,projects:[project]});
  await page.setViewportSize({width,height:768}); await page.emulateMedia({reducedMotion:'reduce'});
  await mkdir(captures,{recursive:true});
  for(const route of ['courses','data','projects','settings','auth','dashboard','courses/STAT-201/lesson-1']) {
    await page.goto(`/${route}`);
    if(route==='projects') await expect(page.getByRole('heading',{name:project.title,exact:true})).toBeVisible();
    if(route==='settings') await expect(page.getByLabel('昵称',{exact:true})).toHaveValue('测试同学');
    if(route==='dashboard') await expect(page.locator('.dashboard-loading')).toBeHidden();
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1)).toBe(true);
    const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical'),route).toEqual([]);
    await page.screenshot({path:`${captures}/${route.replaceAll('/','-')}-after-${width}.png`,animations:'disabled'});
  }
});
