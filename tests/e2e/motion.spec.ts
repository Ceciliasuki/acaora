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
  await expect(curtain.locator("canvas")).toHaveAttribute("data-motion", /paused|unavailable/);
  const action = page.getByRole("link", { name: "新建项目", exact: true }).first();
  await action.hover();
  expect(await action.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await action.focus();
  expect(await action.evaluate((node) => getComputedStyle(node).outlineStyle)).toBe("solid");
  await action.press("Enter");
  await expect(page.getByRole("dialog", { name: "建立一个项目空间" })).toBeVisible();
});

test("the global light surface changes, pauses, and survives workspace navigation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/dashboard");
  const canvas = page.locator("body > .light-curtain canvas");
  await expect(canvas).toHaveAttribute("data-motion", /running|unavailable/);
  test.skip(await canvas.getAttribute("data-motion") === "unavailable", "This browser cannot create a WebGL context; the static fallback is tested separately.");
  const firstFrame = await canvas.screenshot();
  await expect.poll(async () => (await canvas.screenshot()).equals(firstFrame)).toBe(false);
  await page.getByRole("button", { name: "暂停背景动效" }).click();
  await expect(canvas).toHaveAttribute("data-motion", "paused");
  const stillFrame = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect((await canvas.screenshot()).equals(stillFrame)).toBe(true);
  const original = await canvas.elementHandle();
  await page.locator("#app-sidebar").getByRole("link", { name: "数据分析", exact: true }).click();
  await expect(page.getByRole("heading", { name: "数据分析", exact: true })).toBeVisible();
  expect(await original!.evaluate((node) => node.isConnected)).toBe(true);
  await expect(canvas).toHaveAttribute("data-motion", "paused");
  await page.getByRole("button", { name: "开启背景动效" }).click();
  await expect(canvas).toHaveAttribute("data-motion", "running");
});

test("without WebGL the static global material keeps the workspace usable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof getContext>) {
      if (String(args[0]).startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto("/dashboard");
  await expect(page.locator(".light-curtain canvas")).toHaveAttribute("data-motion", "unavailable");
  await expect(page.getByRole("button", { name: "暂停背景动效" })).toBeHidden();
  await expect(page.getByRole("link", { name: "进入论文研究", exact: true })).toBeVisible();
  expect(await page.locator(".light-curtain").evaluate((node) => getComputedStyle(node).backgroundImage)).not.toBe("none");
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
