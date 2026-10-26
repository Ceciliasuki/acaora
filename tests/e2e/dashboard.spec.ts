import { expect, test } from "@playwright/test";
import { freezeDynamicUi, installApiMocks } from "./helpers";

test("overview separates research and learning and lists real recent records once", async ({ page }) => {
  await freezeDynamicUi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page, { signedIn: true, cloudPapers: [
    { id: "paper-a", title: "数字化学习环境下的高校研究能力培养路径探讨", updatedAt: 1786867300000, paragraphs: [{}, {}] },
    { id: "paper-b", title: "在线学习平台的教学效果与学习行为", updatedAt: 1786867200000, paragraphs: [{}] },
    { id: "paper-c", title: "教育技术的应用与评价", updatedAt: 1786867100000, paragraphs: [{}] },
  ], projects: [{ id: "project-a", title: "高校学习行为数据分析", kind: "data", status: "active", metadata: {}, created_at: "2026-08-16T07:00:00Z", updated_at: "2026-08-16T07:00:00Z" }] });
  await page.goto("/dashboard");
  const workspaces = page.getByRole("navigation", { name: "工作空间", exact: true });
  await expect(workspaces.getByRole("link")).toHaveCount(3);
  for (const [name, href] of [["论文阅读", "/papers"], ["数据分析", "/data"], ["研究项目", "/projects"]]) {
    await expect(workspaces.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
  }
  await expect(page.getByText("数字化学习环境下的高校研究能力培养路径探讨", { exact: true })).toHaveCount(1);
  await expect(page.locator(".overview-record")).toHaveCount(4);
  await expect(page.locator(".overview-record").first()).toContainText("2 个段落");
  await expect(page.getByRole("region",{name:"课程学习",exact:true}).getByRole("link",{name:"进入课程",exact:true})).toHaveAttribute("href","/courses");
  await expect(page.locator(".overview-footer")).toContainText("3 篇论文 · 1 个项目");
  await page.screenshot({ path: "test-results/design-preview/dashboard-desktop.png", fullPage: true });
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
    await expect(workspaces.getByRole("link", { name: "研究项目", exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/design-preview/dashboard-mobile-${width}.png`, fullPage: true });
  }
});

test("a failed account read shows a retry rather than fabricated zero counts", async ({ page }) => {
  await installApiMocks(page, { signedIn: true });
  await page.route("**/api/cloud/papers", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/dashboard");
  await expect(page.getByText("暂时无法读取记录")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.locator(".overview-footer")).not.toContainText("0 篇论文");
});

test("guest overview keeps all workspaces available without fetching private records", async ({ page }) => {
  const state = await installApiMocks(page);
  await page.goto("/dashboard");
  await expect(page.getByText("从当前任务开始", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "工作空间", exact: true }).getByRole("link")).toHaveCount(3);
  expect(state.requests).not.toContain("GET /api/cloud/papers");
  expect(state.requests).not.toContain("GET /api/projects");
});
