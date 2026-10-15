import { expect, test } from '@playwright/test';
import { installApiMocks } from './helpers';

const captures = 'outputs/audit-refinements-2026-10-15';

test('expanded shared navigation leaves titles readable across workspaces and narrow desktop', async ({ page }) => {
  await installApiMocks(page, { signedIn: true, projects: [{ id: 'audit-project', title: '测试项目', kind: 'paper', status: 'active', metadata: {}, created_at: '2026-10-15T00:00:00Z', updated_at: '2026-10-15T00:00:00Z' }] });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const [route, width] of [['dashboard', 1440], ['papers', 1440], ['data', 1440], ['projects', 1440], ['settings', 1440], ['papers', 1024]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/${route}`);
    const rail = page.locator('.sidebar-auto-slot');
    await page.locator('#app-sidebar').hover();
    await expect(rail).toHaveAttribute('data-expanded', 'true');
    await expect.poll(async () => (await page.locator('#app-sidebar').boundingBox())?.width).toBe(232);
    await expect.poll(async () => {
      const sidebar = await page.locator('#app-sidebar').boundingBox();
      const title = await page.getByRole('heading', { level: 1 }).boundingBox();
      return Boolean(sidebar && title && title.x >= sidebar.x + sidebar.width);
    }).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    if (route === 'dashboard' || width === 1024) await page.screenshot({ path: `${captures}/${route}-expanded-${width}.png` });
  }
});

test('settings offers a login path to guests and a save action to account holders', async ({ page }) => {
  const state = await installApiMocks(page);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: '前往登录', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '保存资料', exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${captures}/settings-guest.png` });
  state.signedIn = true;
  await page.reload();
  await expect(page.getByLabel('昵称', { exact: true })).toHaveValue('测试同学');
  await expect(page.getByRole('button', { name: '保存资料', exact: true })).toBeEnabled();
});

test('a fresh homepage omits formula styles while course formulas keep their typesetting', async ({ page }) => {
  await installApiMocks(page);
  await page.goto('/');
  expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('KaTeX')))).toBe(false);
  await page.goto('/courses/STAT-201/lesson-1');
  await expect(page.locator('.katex').first()).toBeVisible();
  await expect(page.locator('math').first()).toBeAttached();
  await expect.poll(() => page.locator('.katex').first().evaluate(node => getComputedStyle(node).fontFamily)).toContain('KaTeX');
  await page.screenshot({ path: `${captures}/course-formulas.png` });
});

test('blocking the motion preference store still allows the current page toggle', async ({ page }) => {
  await installApiMocks(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const read = Storage.prototype.getItem; const write = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) { if (key === 'acaora:ambient-motion') throw new DOMException('Blocked', 'SecurityError'); return read.call(this, key); };
    Storage.prototype.setItem = function (key, value) { if (key === 'acaora:ambient-motion') throw new DOMException('Blocked', 'SecurityError'); return write.call(this, key, value); };
  });
  await page.goto('/dashboard');
  const canvas = page.locator('.light-curtain canvas');
  await expect(canvas).toHaveAttribute('data-motion', /paused|unavailable/);
  test.skip(await canvas.getAttribute('data-motion') === 'unavailable', 'No WebGL context is available.');
  await page.getByRole('button', { name: '开启背景动效' }).click();
  await expect(canvas).toHaveAttribute('data-motion', 'running');
  await page.getByRole('button', { name: '暂停背景动效' }).click();
  await expect(canvas).toHaveAttribute('data-motion', 'paused');
});
