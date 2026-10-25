import {trackBrowserRuntimeErrors} from './browser-runtime-errors';
import {test,expect} from '@playwright/test';

// Real Next routes + installed Supabase SDK + HTTPS browser cookies. Only the
// upstream identity provider is a disposable local fixture, with no real user.
test('HTTPS session cookies survive reload, stay private and isolate browser sessions',async({page,browser,baseURL,browserName},info)=>{
 const diagnostics=trackBrowserRuntimeErrors(page);
 await page.goto('/auth');await page.waitForLoadState('networkidle');await page.getByLabel('邮箱地址').fill('cookie-audit@example.invalid');await page.locator('#account-password').fill('WrongPass1');await page.getByRole('button',{name:'登录账户',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'邮箱或密码不正确'})).toBeVisible();
 await page.waitForLoadState('networkidle');await page.locator('#account-password').fill('CookieAudit1');const loginResponse=page.waitForResponse(response=>response.url().endsWith('/api/auth/login')&&response.request().method()==='POST');await page.getByRole('button',{name:'登录账户',exact:true}).click();const loginHeaders=await (await loginResponse).headersArray();const sessionHeaders=loginHeaders.filter(header=>header.name.toLowerCase()==='set-cookie'&&header.value.includes('auth-token'));expect(sessionHeaders.length).toBeGreaterThan(0);for(const header of sessionHeaders){expect(header.value).toMatch(/;\s*HttpOnly/i);expect(header.value).toMatch(/;\s*Secure/i);expect(header.value).toMatch(/;\s*SameSite=lax/i);}await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('.overview-footer')).toContainText('cookie-audit@example.invalid');
 const cookies=(await page.context().cookies()).filter(cookie=>cookie.name.includes('auth-token'));expect(cookies.length).toBeGreaterThan(0);for(const cookie of cookies){expect(cookie.httpOnly).toBe(true);expect(cookie.secure).toBe(true);expect(cookie.path).toBe('/');}expect(await page.evaluate(()=>document.cookie)).not.toContain('auth-token');
 await page.waitForLoadState('networkidle');await page.reload();await expect(page.locator('.overview-footer')).toContainText('cookie-audit@example.invalid');

 await info.attach('cookie-metadata',{body:JSON.stringify(cookies.map(({name,httpOnly,secure,sameSite,path})=>({name,httpOnly,secure,sameSite,path}))),contentType:'application/json'});
 const independent=await browser.newContext({baseURL,ignoreHTTPSErrors:true});
 try{
  const other=await independent.newPage();await other.goto('/dashboard');await expect(other.locator('.overview-footer')).toContainText('未登录');
  const login=await other.request.post('/api/auth/login',{data:{email:'cookie-audit@example.invalid',password:'CookieAudit1'}});expect(login.status()).toBe(200);await other.reload();await expect(other.locator('.overview-footer')).toContainText('cookie-audit@example.invalid');
  const sameSession=await page.context().newPage();await sameSession.goto('/settings');await expect(sameSession.getByRole('textbox',{name:'昵称',exact:true})).toHaveValue('Cookie Audit');
  await page.getByRole('button',{name:'退出',exact:true}).click();await expect(page.locator('.overview-footer')).toContainText('未登录');await expect(sameSession.getByRole('heading',{name:'登录后管理个人资料',exact:true})).toBeVisible();
  await other.reload();await expect(other.locator('.overview-footer')).toContainText('cookie-audit@example.invalid');expect((await page.request.get('/api/auth/session')).headers()['cache-control']).toContain('no-store');expect((await (await page.request.get('/api/auth/session')).json()).user).toBeNull();
 }finally{await independent.close();}
 const runtime=diagnostics(browserName);await info.attach('cancelled-prefetch-diagnostics',{body:JSON.stringify(runtime.cancelledPrefetches),contentType:'application/json'});expect(runtime.unexpected).toEqual([]);await info.attach('browser-version',{body:browser.version(),contentType:'text/plain'});
});


test('SameSite Lax blocks session cookies on a cross-site subresource request',async({page,baseURL,browserName})=>{
 test.skip(browserName==='webkit'&&process.platform==='win32','Windows WebKit upstream does not implement SameSite: microsoft/playwright browsercontext-cookies CO-006/007. Linux CI still checks WebKit.');
 const response=await page.request.post('/api/auth/login',{data:{email:'cookie-audit@example.invalid',password:'CookieAudit1'}});expect(response.status()).toBe(200);const cookies=(await page.context().cookies()).filter(cookie=>cookie.name.includes('auth-token'));expect(cookies.length).toBeGreaterThan(0);for(const cookie of cookies)expect(cookie.sameSite).toBe('Lax');
 await page.goto(baseURL!.replace('127.0.0.1','localhost')+'/audit/cross-site');const sent=await page.evaluate(async origin=>(await (await fetch(origin+'/audit/cookie-echo',{credentials:'include'})).json()).hasSession,baseURL!);expect(sent).toBe(false);
});
