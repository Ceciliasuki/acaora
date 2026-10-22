import {expect,test} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {installApiMocks} from './helpers';

const captures='outputs/course-selection-2026-10-22';
test('COURSE-SELECT-01 list precedes syllabus and learning, with return and actual resume',async({page})=>{
 const state=await installApiMocks(page,{signedIn:true});await page.goto('/courses');
 const choices=page.getByRole('navigation',{name:'选择课程',exact:true});
 await expect(choices.getByRole('link')).toHaveCount(7);
 await expect(page.locator('.course-overview')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'章节导航',exact:true})).toHaveCount(0);
 await choices.getByRole('link',{name:'选择课程：概率论与数理统计',exact:true}).press('Enter');
 await expect(page).toHaveURL('/courses/STAT-201');
 await page.getByRole('link',{name:'开始学习概率论与数理统计',exact:true}).click();
 await expect(page).toHaveURL('/courses/STAT-201/lesson-1');
 await page.getByRole('button',{name:'标记本节已读',exact:true}).click();
 await expect.poll(()=>state.courseRecords[JSON.stringify([state.userId,'STAT-201'])]?.completedLessonIds).toEqual(['lesson-1']);
 await page.getByRole('link',{name:'返回课程列表',exact:true}).click();
 await expect(choices).toBeVisible();
 await choices.getByRole('link',{name:'选择课程：概率论与数理统计',exact:true}).click();
 await expect(page.getByRole('link',{name:'继续学习',exact:true})).toHaveAttribute('href','/courses/STAT-201/lesson-1');
 await expect(page.getByText('核心已读 1 / 12 节',{exact:true})).toBeVisible();
 await page.goBack();await expect(choices).toBeVisible();
 await page.goForward();await expect(page).toHaveURL('/courses/STAT-201');
});

test('COURSE-SELECT-02 search and track filters compose, empty result recovers and clearing restores focus',async({page})=>{
 await installApiMocks(page);await page.goto('/courses');
 const search=page.getByRole('searchbox',{name:'搜索课程',exact:true});
 const tracks=page.getByRole('group',{name:'课程方向',exact:true});
 await tracks.getByRole('button',{name:'经济学',exact:true}).click();
 await expect(page.getByRole('navigation',{name:'选择课程',exact:true}).getByRole('link')).toHaveCount(4);
 await search.fill('STAT-201');await expect(page.getByText('没有找到符合条件的课程',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'清空课程搜索',exact:true}).click();await expect(search).toBeFocused();
 await expect(tracks.getByRole('button',{name:'经济学',exact:true})).toHaveAttribute('aria-pressed','true');
 await search.fill('不存在的课程');await page.getByRole('button',{name:'显示全部课程',exact:true}).click();
 await expect(search).toHaveValue('');await expect(page.getByRole('navigation',{name:'选择课程',exact:true}).getByRole('link')).toHaveCount(7);
 await search.fill('stat-302');await expect(page.getByRole('link',{name:'选择课程：回归分析',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'选择课程：回归分析',exact:true}).click();await expect(page).toHaveURL('/courses/STAT-302');await page.reload();
 await expect(page.getByRole('heading',{name:'回归分析',exact:true})).toBeVisible();
});

for(const width of [1440,1024,375])test(`COURSE-SELECT-03 ${width}px selection is readable with visible focus and no overflow`,async({page})=>{
 await installApiMocks(page);await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/courses');await expect(page.getByRole('link',{name:'选择课程：概率论与数理统计',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'课程方向',exact:true})).toHaveAttribute('data-motion-ready','true');
 await mkdir(captures,{recursive:true});await page.screenshot({path:`${captures}/selection-${width}.png`,fullPage:true});
 await page.getByRole('searchbox',{name:'搜索课程',exact:true}).focus();await page.screenshot({path:`${captures}/search-focus-${width}.png`});
 const size=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));expect(size.scroll).toBeLessThanOrEqual(size.width+1);
 const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(audit.violations.filter(v=>v.impact==='serious'||v.impact==='critical')).toEqual([]);
});
