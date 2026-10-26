import { expect, test } from "@playwright/test";
import { installApiMocks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page, { signedIn: true });
});

test('reduced motion keeps task controls steady without a background shader',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/dashboard');await expect(page.locator('.light-curtain,.ambient-toggle')).toHaveCount(0);
 const action=page.getByRole('navigation',{name:'工作空间',exact:true}).getByRole('link',{name:'研究项目',exact:true});await action.hover();expect(await action.evaluate(node=>getComputedStyle(node).translate)).toBe('none');await action.focus();expect(await action.evaluate(node=>getComputedStyle(node).outlineStyle)).toBe('solid');
});
test('interface motion preference persists across task navigation',async({page})=>{
 await page.goto('/settings');const control=page.getByRole('checkbox',{name:/界面动效/});await control.uncheck();await expect(page.locator('html')).toHaveAttribute('data-interface-motion','off');await page.goto('/data');await expect(page.locator('html')).toHaveAttribute('data-interface-motion','off');await expect(page.locator('.ambient-toggle')).toHaveCount(0);
});

test("project creation keeps hover and press feedback and opens its dialog", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/projects");
  // With no existing projects the workspace opens onboarding automatically.
  await page.getByRole("dialog", { name: "建立一个项目空间" }).getByRole("button", { name: "关闭", exact: true }).click();
  const action = page.getByRole("button", { name: "新建项目", exact: true });
  await expect(action).toBeEnabled();
  const rest = await action.evaluate((node) => getComputedStyle(node).backgroundColor);
  await action.hover();
  await expect.poll(() => action.evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe(rest);
  const box = await action.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect.poll(() => action.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).a)).toBeLessThan(1);
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "建立一个项目空间" })).toBeVisible();
});

test("a submitting button stays disabled and still under the pointer", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  let submissions = 0;
  await page.route("**/api/auth/login", async (route) => {
    submissions++;
    await pending;
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "测试请求结束" }) });
  });
  await page.goto("/auth");
  await page.locator("#account-email").fill("student@example.com");
  await page.locator("#account-password").fill("ValidPass1");
  const submit = page.locator(".auth-submit");
  try {
    await submit.click();
    await expect(submit).toBeDisabled();
    expect(await submit.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
    expect(await submit.evaluate((node) => getComputedStyle(node, "::after").display)).toBe("none");
    expect(submissions).toBe(1);
  } finally { release(); }
});

test("the 700px drawer stays out of page flow and traps keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await page.goto("/dashboard");
  const drawer = page.locator("#app-sidebar");
  await expect(drawer).toHaveAttribute("inert", "");
  expect((await page.getByRole("heading", { name: "总览", exact: true, level: 1 }).boundingBox())!.y).toBeLessThan(180);
  expect(await page.getByRole("button", { name: "打开主导航" }).evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
  await page.locator(".overview-footer").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "打开主导航" })).toBeInViewport();
  await page.getByRole("button", { name: "打开主导航" }).click();
  await expect(page.getByRole("button", { name: "关闭主导航", exact: true }).last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "打开主导航" })).toBeFocused();
});
