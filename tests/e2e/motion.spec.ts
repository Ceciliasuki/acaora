import { expect, test } from "@playwright/test";
import { installApiMocks } from "./helpers";

test.beforeEach(async ({ page }) => {
  await installApiMocks(page, { signedIn: true });
});

test("light curtain is decorative and reduced motion keeps controls steady", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  const curtain = page.locator("body > .light-curtain");
  await expect(curtain).toHaveAttribute("aria-hidden", "true");
  expect(await curtain.evaluate((node) => getComputedStyle(node).pointerEvents)).toBe("none");
  expect(await curtain.locator("svg").first().evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
  const action = page.getByRole("link", { name: "新建项目", exact: true }).first();
  await action.hover();
  expect(await action.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await action.focus();
  expect(await action.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
  await action.press("Enter");
  await expect(page.getByRole("dialog", { name: "建立一个项目空间" })).toBeVisible();
});

test("primary action has hover light and press feedback without changing its target", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/dashboard");
  const action = page.getByRole("link", { name: "新建项目", exact: true }).first();
  await expect(action).toHaveAttribute("href", "/projects?new=1");
  const rest = await action.evaluate((node) => getComputedStyle(node).boxShadow);
  await action.hover();
  await expect.poll(() => action.evaluate((node) => getComputedStyle(node).boxShadow)).not.toBe(rest);
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
  expect((await page.locator(".overview-header").boundingBox())!.y).toBeLessThan(180);
  expect(await page.getByRole("button", { name: "打开主导航" }).evaluate((node) => getComputedStyle(node).position)).toBe("fixed");
  await page.locator(".overview-footer").scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "打开主导航" })).toBeInViewport();
  await page.getByRole("button", { name: "打开主导航" }).click();
  await expect(page.getByRole("button", { name: "关闭主导航", exact: true }).last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "打开主导航" })).toBeFocused();
});
