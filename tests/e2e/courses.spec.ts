import {expect,test} from '@playwright/test';
import {installApiMocks} from './helpers';
import AxeBuilder from '@axe-core/playwright';
test('COURSE-01 preset lessons work without imported material or AI keys',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses');
 await page.getByRole('link',{name:'开始学习概率论与数理统计'}).click();
 // Next dev compiles this route on first navigation; the trace measured 4.8s.
 await expect(page).toHaveURL('/courses/STAT-201/lesson-1',{timeout:15000});
 await expect(page.getByRole('heading',{name:'学习目标',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'查看解析'}).first()).toBeVisible();
 const calculation=page.getByRole('region',{name:/第 3 题/});
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
 const calculation=page.getByRole('region',{name:/第 3 题/});await calculation.getByLabel('输入数值答案').fill('0.6');
 await context.setOffline(true);await calculation.getByRole('button',{name:'检查答案'}).click();
 await expect(calculation).toContainText('回答正确');await expect(page.getByRole('heading',{name:'学习目标',exact:true})).toBeVisible();await context.setOffline(false);
});
test('COURSE-05 invalid course paths return 404',async({page})=>{
 await installApiMocks(page);for(const url of ['/courses/UNKNOWN/lesson-1','/courses/STAT-201/UNKNOWN']) {const response=await page.goto(url);expect(response?.status()).toBe(404);}
});
test('COURSE-06 saved answers restore and untrusted mathematical text has a safe fallback',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses/STAT-201/lesson-1');
 const calculation=page.getByRole('region',{name:/第 3 题/});await calculation.getByLabel('输入数值答案').fill('0.7');await calculation.getByRole('button',{name:'检查答案'}).click();
 const proof=page.getByRole('region',{name:/第 5 题/});await proof.getByRole('textbox').fill('\\(\\unrecognized{a}\\) <script>alert(1)</script>');await proof.getByRole('button',{name:'记录作答'}).click();
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
