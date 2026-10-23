import {test,expect} from '@playwright/test';
import {installApiMocks} from './helpers';
for(const width of [1366,375])test(`Help entry fits collapsed rail and expanded navigation at ${width}px`,async({page})=>{
 await installApiMocks(page,{signedIn:true});await page.setViewportSize({width,height:812});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/help');
 const help=page.locator('#app-sidebar').getByRole('link',{name:'帮助与恢复',exact:true});
 if(width===375)await page.getByRole('button',{name:'打开主导航',exact:true}).click();
 await expect(help).toBeVisible();
 expect(await help.locator('svg').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(18);
 expect(await help.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(60);
 if(width>760){await expect(help.locator('span')).toHaveCSS('opacity','0');await page.getByRole('button',{name:'展开或收起主导航',exact:true}).click();}
 await expect(help.locator('span')).toHaveCSS('opacity','1');
 expect(await help.locator('span').evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(30);
 await help.focus();await expect(help).toBeFocused();await help.press('Enter');
 await expect(page.getByRole('heading',{name:'帮助与恢复',exact:true,level:1})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
