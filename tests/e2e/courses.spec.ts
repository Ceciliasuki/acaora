import {expect,test} from '@playwright/test';
import {installApiMocks} from './helpers';
import AxeBuilder from '@axe-core/playwright';

test('COURSE-18 every checked comprehensive case is reachable directly from the main course centre',async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.goto('/courses');
 for(const [code,name] of [['STAT-201','概率论与数理统计'],['ECON-204','微观经济学'],['STAT-302','回归分析'],['ECON-301','计量经济学'],['STAT-306','多元统计分析'],['TRADE-305','国际贸易学'],['FIN-308','国际金融']]){
  await page.getByRole('button',{name:`${code} ${name}`,exact:true}).click();await expect(page.getByRole('link',{name:'综合案例',exact:true})).toHaveAttribute('href',`/courses/${code}/assessments/case-study`);
 }
});

test('COURSE-17 finance lessons keep one quote direction and restore forward-hedging practice',async({page})=>{
 await installApiMocks(page,{signedIn:true});
 for(let i=1;i<=9;i++){await page.goto(`/courses/FIN-308/lesson-${i}`);await expect(page.locator('form:visible')).toHaveCount(3);}
 await page.goto('/courses/FIN-308/assessments/case-study');const q=page.locator('[aria-labelledby="title-FIN-308-case-receipt"]');await q.getByLabel('输入数值答案').fill('714000');await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');await page.reload();await expect(q.getByLabel('输入数值答案')).toHaveValue('714000');
 await page.setViewportSize({width:375,height:900});await page.goto('/courses/FIN-308/lesson-4');await expect(page.locator('math').first()).toBeAttached();
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);await page.screenshot({path:'test-results/course-FIN-308-375.png'});
});

test('COURSE-16 trade lessons distinguish welfare transfers and support a simple original tariff case',async({page})=>{
 await installApiMocks(page,{signedIn:true});
 for(let i=1;i<=9;i++){await page.goto(`/courses/TRADE-305/lesson-${i}`);await expect(page.locator('form:visible')).toHaveCount(3);}
 await page.goto('/courses/TRADE-305/assessments/case-study');
 const q=page.locator('[aria-labelledby="title-TRADE-305-case-dwl"]');await q.getByLabel('输入数值答案').fill('100');await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');await page.reload();await expect(q.getByLabel('输入数值答案')).toHaveValue('100');
 await page.setViewportSize({width:375,height:900});await page.goto('/courses/TRADE-305/lesson-6');await expect(page.getByRole('img',{name:/小国关税/})).toBeVisible();
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.getByRole('img',{name:/小国关税/}).scrollIntoViewIfNeeded();await page.screenshot({path:'test-results/course-TRADE-305-375.png'});
});

test('COURSE-15 multivariate lessons preserve a held-out classification error and readable matrix formulas',async({page})=>{
 await installApiMocks(page,{signedIn:true});
 for(let i=1;i<=9;i++){await page.goto(`/courses/STAT-306/lesson-${i}`);await expect(page.locator('form:visible')).toHaveCount(3);await expect(page.locator('math').first()).toBeAttached();}
 await page.goto('/courses/STAT-306/assessments/case-study');const q=page.locator('[aria-labelledby="title-STAT-306-case-accuracy"]');
 await q.getByLabel('输入数值答案').fill('0.75');await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');
 await page.getByText('参考：案例参考流程',{exact:true}).click();await expect(page.getByText(/第三条类0被误判/)).toBeVisible();
 await page.reload();await expect(q.getByLabel('输入数值答案')).toHaveValue('0.75');
 await page.setViewportSize({width:375,height:900});await page.goto('/courses/STAT-306/lesson-3');
 const formula=page.getByRole('region',{name:'数学公式，可横向滚动',exact:true}).first();await formula.scrollIntoViewIfNeeded();await formula.focus();await expect(formula).toBeFocused();await page.keyboard.press('ArrowRight');
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.screenshot({path:'test-results/course-STAT-306-375.png'});
});

test('COURSE-14 econometrics includes an honest small-sample case with optional reference steps',async({page})=>{
 await installApiMocks(page,{signedIn:true});
 for(let i=1;i<=10;i++){await page.goto(`/courses/ECON-301/lesson-${i}`);await expect(page.locator('form:visible')).toHaveCount(3);}
 await page.goto('/courses/ECON-301/assessments/case-study');
 await expect(page.getByRole('heading',{name:'案例参考流程',exact:true})).toBeHidden();
 const q=page.locator('[aria-labelledby="title-ECON-301-case-did"]');await q.getByLabel('输入数值答案').fill('3');await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');
 await page.getByText('参考：案例参考流程',{exact:true}).click();
 await expect(page.getByText(/\[−6.067832,12.067832\]/)).toBeVisible();
 await page.reload();await expect(q.getByLabel('输入数值答案')).toHaveValue('3');
 await page.setViewportSize({width:375,height:900});await page.goto('/courses/ECON-301/lesson-6');
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 await page.screenshot({path:'test-results/course-ECON-301-375.png'});
});

test('COURSE-13 regression core, elective and original-data scenario remain simple and restorable',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});
 for(let i=1;i<=10;i++){
  await page.goto(`/courses/STAT-302/lesson-${i}`);
  await expect(page.locator('form:visible')).toHaveCount(3);
  await expect(page.getByRole('heading',{name:'完整例题',exact:true})).toBeVisible();
 }
 await page.goto('/courses/STAT-302/lesson-8');
 await expect(page.getByRole('link',{name:/下一节/})).toHaveCount(0);
 await page.goto('/courses/STAT-302');
 await expect(page.getByText('核心已读 0 / 8 节',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'综合案例',exact:true}).click();
 const q=page.locator('[aria-labelledby="title-STAT-302-case-mse"]');
 await q.getByLabel('输入数值答案').fill('0.28321995464852634');await q.getByRole('button',{name:'检查答案'}).click();await expect(q).toContainText('回答正确');
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-302'])]?.attempts.length).toBe(1);
 await page.reload();await expect(q.getByLabel('输入数值答案')).toHaveValue('0.28321995464852634');
 await page.setViewportSize({width:375,height:900});await page.goto('/courses/STAT-302/lesson-7');
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.screenshot({path:'test-results/course-STAT-302-375.png'});
});

test('COURSE-12 guided lessons show three exercises and preserve optional review links',async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.goto('/courses/STAT-201/lesson-1');
 await expect(page.locator('form:visible')).toHaveCount(3);
 await expect(page.getByText('例 2 ·', {exact:false})).toBeHidden();
 await page.getByText('更多例题（选学）',{exact:true}).click();
 await expect(page.getByText('例 2 ·',{exact:false})).toBeVisible();
 await page.goto('/courses/STAT-201/lesson-1#title-STAT-201-l1-q2');
 // The optional question keeps its original ID and is reachable from review.
 await expect(page.locator('[aria-labelledby="title-STAT-201-l1-q2"]')).toBeVisible();
 await expect(page.locator('form:visible')).toHaveCount(6);
 await page.goto('/courses/STAT-201');
 await expect(page.getByRole('link',{name:'章节作业',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'综合案例',exact:true})).toHaveCount(1);
 await expect(page.getByRole('link',{name:'复习作答记录',exact:true})).toBeHidden();
 await page.getByText('学习记录',{exact:true}).click();
 await expect(page.getByRole('link',{name:'复习作答记录',exact:true})).toBeVisible();
});
test('COURSE-01 preset lessons work without imported material or AI keys',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses');
 await page.getByRole('link',{name:'开始学习概率论与数理统计'}).click();
 // Next dev compiles this route on first navigation; the trace measured 4.8s.
 await expect(page).toHaveURL('/courses/STAT-201/lesson-1',{timeout:15000});
 await expect(page.getByRole('heading',{name:'学习目标',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'查看解析'}).first()).toBeVisible();
 const calculation=page.locator('[aria-labelledby="title-STAT-201-l1-q3"]');
 await calculation.getByLabel('输入数值答案').fill('0.6');await calculation.getByRole('button',{name:'检查答案'}).click();
 await expect(calculation).toContainText('回答正确');await calculation.getByRole('button',{name:'查看解析'}).click();
 await expect(calculation.getByRole('heading',{name:'答案与解析'})).toBeVisible();
 expect(state.requests.some(x=>x.includes('/api/papers/ai'))).toBe(false);
 await expect(page.getByLabel('课程资料',{exact:true})).toHaveCount(0);
});
test('COURSE-02 completing a lesson persists and continue links use the actual location',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses/STAT-201/lesson-1');
 await page.getByRole('button',{name:'标记本节已读'}).click();await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.completedLessonIds).toEqual(['lesson-1']);
 await page.reload();await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 await page.goto('/courses/STAT-201');await expect(page.getByRole('link',{name:'继续学习'})).toHaveAttribute('href','/courses/STAT-201/lesson-1');
});
test('COURSE-03 unavailable sync preserves IndexedDB queue across refresh and account changes',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true,courseSyncStatus:503});await page.goto('/courses/STAT-201/lesson-1');
 await page.getByRole('button',{name:'标记本节已读'}).click();await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 state.userId='second-user';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(page.getByRole('button',{name:'标记本节已读'})).toBeVisible();
 state.userId='user-e2e';await page.evaluate(()=>window.dispatchEvent(new Event('acaora:auth-change')));
 await expect(page.getByText('本节已读',{exact:true})).toBeVisible();
 await expect(page.getByText('本机记录已保留，等待云端同步。',{exact:true})).toBeVisible();
 state.courseSyncStatus=200;await page.getByRole('button',{name:'重试同步'}).click();
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.completedLessonIds).toEqual(['lesson-1']);
});
test('COURSE-04 loaded lesson and answers survive loss of network',async({page,context})=>{
 await installApiMocks(page,{signedIn:true});await page.goto('/courses/STAT-201/lesson-1');
 const calculation=page.locator('[aria-labelledby="title-STAT-201-l1-q3"]');await calculation.getByLabel('输入数值答案').fill('0.6');
 await context.setOffline(true);await calculation.getByRole('button',{name:'检查答案'}).click();
 await expect(calculation).toContainText('回答正确');await expect(page.getByRole('heading',{name:'学习目标',exact:true})).toBeVisible();await context.setOffline(false);
});
test('COURSE-05 invalid course paths return 404',async({page})=>{
 await installApiMocks(page);for(const url of ['/courses/UNKNOWN/lesson-1','/courses/STAT-201/UNKNOWN']) {const response=await page.goto(url);expect(response?.status()).toBe(404);}
});
test('COURSE-06 saved answers restore and untrusted mathematical text has a safe fallback',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses/STAT-201/lesson-1');
 const calculation=page.locator('[aria-labelledby="title-STAT-201-l1-q3"]');await calculation.getByLabel('输入数值答案').fill('0.7');await calculation.getByRole('button',{name:'检查答案'}).click();
 const proof=page.locator('[aria-labelledby="title-STAT-201-l1-q6"]');await proof.getByRole('textbox').fill('\\(\\unrecognized{a}\\) <script>alert(1)</script>');await proof.getByRole('button',{name:'记录作答'}).click();
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.attempts.length).toBe(2);
 await page.reload();await expect(calculation.getByLabel('输入数值答案')).toHaveValue('0.7');
 await page.goto('/courses/STAT-201/review');await expect(page.getByText(/公式暂时无法排版/)).toBeVisible();await expect(page.getByText('上次作答：',{exact:false})).toHaveCount(2);
});
for(const width of [1440,375])test(`@a11y COURSE-07 ${width}px lesson has no serious accessibility errors or page overflow`,async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.setViewportSize({width,height:900});await page.goto('/courses/STAT-201/lesson-1');
 await expect(page.getByRole('button',{name:'查看解析'}).first()).toBeVisible();await expect(page.locator('math').first()).toBeAttached();
 await page.screenshot({path:`test-results/course-lesson-top-${width}.png`});
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const table=page.getByRole('region',{name:'事件关系与计算口径'});await table.focus();await expect(table).toBeFocused();await page.keyboard.press('ArrowRight');
 const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(results.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.screenshot({path:`test-results/course-lesson-${width}.png`,fullPage:true});
});
test('COURSE-08 complete probability course includes inference and assessed questions with review links',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});
 await page.goto('/courses/STAT-201/lesson-7');
 await expect(page.getByRole('heading',{name:'进阶：截断样本需要条件密度',exact:true})).toBeHidden();
 await page.getByText('选学：进阶：截断样本需要条件密度',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'进阶：截断样本需要条件密度',exact:true})).toBeVisible();
 await page.getByText('例 3（选学）',{exact:true}).click();
 await expect(page.getByRole('heading',{name:'例 3 · 固定门槛截断的速率估计',exact:true})).toBeVisible();
 await page.goto('/courses/STAT-201/assessments/chapter-11');
 await expect(page.getByRole('region',{name:/第 8 题/})).toBeVisible();
 await page.goto('/courses/STAT-201/assessments/final');
 await expect(page.getByRole('region',{name:/第 12 题/})).toBeVisible();
 const calculation=page.getByRole('region',{name:/第 3 题/});
 await calculation.getByLabel('输入数值答案').fill('0.3');await calculation.getByRole('button',{name:'检查答案'}).click();
 await expect(calculation).toContainText('答案还不一致');
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.attempts.some(a=>a.questionId==='STAT-201-final-q3')).toBe(true);
 await page.goto('/courses/STAT-201/review');
 await page.getByRole('link',{name:'回到题目',exact:true}).click();
 await expect(page).toHaveURL(/\/assessments\/final#title-STAT-201-final-q3$/);
 await expect(calculation.getByLabel('输入数值答案')).toHaveValue('0.3');
 await calculation.getByLabel('输入数值答案').fill('0.2');await calculation.getByRole('button',{name:'检查答案'}).click();
 await expect(calculation).toContainText('回答正确');
 expect(state.requests.some(x=>x.includes('/api/papers/ai'))).toBe(false);
});
test('@a11y COURSE-09 inference lecture and final assessment stay readable on mobile',async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.setViewportSize({width:375,height:900});
 for(const [name,url] of [['inference','/courses/STAT-201/lesson-8'],['final','/courses/STAT-201/assessments/final']]){
  await page.goto(url);await expect(page.getByRole('button',{name:'查看解析'}).first()).toBeVisible();
  const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
  const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
  await page.screenshot({path:`test-results/course-STAT-201-${name}-375.png`});
 }
});
test('COURSE-10 consumer diagram, zero-trade boundary and chapter practice work in the preset micro course',async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.goto('/courses/ECON-204/lesson-2');
 const diagram=page.getByRole('img',{name:/预算线2x/});
 await expect(diagram).toBeVisible();expect(await diagram.evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await page.goto('/courses/ECON-204/lesson-7');
 await page.getByText('更多练习（选学）',{exact:true}).click();
 const boundary=page.locator('[aria-labelledby="title-ECON-204-l7-q4"]');await boundary.getByLabel('输入数值答案').fill('0');await boundary.getByRole('button',{name:'检查答案'}).click();await expect(boundary).toContainText('回答正确');
 await page.goto('/courses/ECON-204/assessments/chapter-5');
 const insurance=page.getByRole('region',{name:/第 4 题/});await insurance.getByLabel('输入数值答案').fill('10.400811771689499');await insurance.getByRole('button',{name:'检查答案'}).click();await expect(insurance).toContainText('回答正确');
 await page.reload();await expect(insurance.getByLabel('输入数值答案')).toHaveValue('10.400811771689499');
});
test('@a11y COURSE-11 original economic plots scroll with keyboard and stay inside the mobile page',async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.setViewportSize({width:375,height:900});await page.goto('/courses/ECON-204/lesson-7');
 const plot=page.getByRole('region',{name:/原创教学图：从量税/});await plot.scrollIntoViewIfNeeded();await plot.focus();await expect(plot).toBeFocused();
 await page.keyboard.press('ArrowRight');await expect.poll(()=>plot.evaluate(element=>element.scrollLeft)).toBeGreaterThan(0);
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
 await page.screenshot({path:'test-results/course-ECON-204-tax-375.png'});
});
