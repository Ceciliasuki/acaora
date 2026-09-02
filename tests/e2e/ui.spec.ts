import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freezeDynamicUi, installApiMocks, type MockProject, type MockState } from "./helpers";

const now = "2026-08-16T08:00:00.000Z";
const project: MockProject = {
  id: "project-visual",
  title: "城乡学生数字学习行为差异研究",
  kind: "paper",
  status: "active",
  metadata: { goal: "完成可复核的研究报告", deadline: "2026-09-10", notes: "先完成变量定义。", tasks: [{ id: "task-1", text: "整理变量字典", done: false }] },
  created_at: now,
  updated_at: now,
};

async function ready(page: Page, path: string) {
  await page.goto(path);
  if (path === "/dashboard") await expect(page.locator(".dashboard-loading")).toBeHidden();
  if (path === "/papers") await expect(page.getByText("云端记忆已同步")).toHaveCount(1);
  if (path === "/projects") await expect(page.getByRole("heading", { name: project.title })).toBeVisible();
  if (path === "/settings") await expect(page.locator("#settings-name")).toHaveValue("测试同学");
  if (path === "/courses") await expect(page.getByText("deepseek-v4-flash", { exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

let mockState: MockState;
test.beforeEach(async ({ page }) => {
  await freezeDynamicUi(page);
  mockState = await installApiMocks(page, { signedIn: true, projects: [project] });
});

for (const [name, path, prepare] of [
  ["home", "/", undefined],
  ["auth-login", "/auth", undefined],
  ["auth-register", "/auth", async (page: Page) => page.getByRole("tab", { name: "注册账户" }).click()],
  ["dashboard-empty", "/dashboard", undefined],
  ["courses", "/courses", undefined],
  ["papers", "/papers", undefined],
  ["data", "/data", undefined],
  ["projects", "/projects", undefined],
  ["settings", "/settings", undefined],
] as const) {
  test(`@visual ${name} visual baseline`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    if (name === "dashboard-empty") mockState.projects = [];
    await ready(page, path);
    if (prepare) await prepare(page);
    await expect(page).toHaveScreenshot(`${name}-1440.png`, { fullPage: true, animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 });
  });
}

for (const viewport of [
  { id: "UI-01", width: 375, height: 812 },
  { id: "UI-02", width: 768, height: 1024 },
  { id: "UI-03", width: 1440, height: 900 },
]) {
  test(`${viewport.id} ${viewport.width}×${viewport.height} has no document-level overflow`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const path of ["/", "/auth", "/dashboard", "/courses", "/papers", "/data", "/projects", "/settings"]) {
      await ready(page, path);
      const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
      expect(dimensions.scrollWidth, `${path} overflowed at ${viewport.width}px`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  });
}

test("@a11y critical workspace accessibility smoke", async ({ page }) => {
  for (const path of ["/", "/auth", "/dashboard", "/courses", "/papers", "/data", "/projects", "/settings"]) {
    await ready(page, path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const blocking = results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious");
    expect(blocking, `${path}: ${blocking.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ")}`).toEqual([]);
  }
});
