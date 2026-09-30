import { expect, test } from "@playwright/test";
import { freezeDynamicUi, installApiMocks } from "./helpers";

test("overview uses real recent records without duplicating the lead", async ({ page }) => {
  await freezeDynamicUi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page, { signedIn: true, cloudPapers: [
    { id: "paper-a", title: "数字化学习环境下的高校研究能力培养路径探讨", updatedAt: 1786867300000, paragraphs: [{}, {}] },
    { id: "paper-b", title: "在线学习平台的教学效果与学习行为", updatedAt: 1786867200000, paragraphs: [{}] },
    { id: "paper-c", title: "教育技术的应用与评价", updatedAt: 1786867100000, paragraphs: [{}] },
  ], projects: [{ id: "project-a", title: "高校学习行为数据分析", kind: "data", status: "active", metadata: {}, created_at: "2026-08-16T07:00:00Z", updated_at: "2026-08-16T07:00:00Z" }] });
  await page.goto("/dashboard");
  await expect(page.locator(".overview-feature h3")).toHaveText("数字化学习环境下的高校研究能力培养路径探讨");
  await expect(page.getByText("数字化学习环境下的高校研究能力培养路径探讨", { exact: true })).toHaveCount(1);
  await expect(page.locator(".overview-record")).toHaveCount(3);
  await expect(page.locator(".overview-feature p")).toContainText("2 个段落");
  await expect(page.locator(".overview-footer")).toContainText("3 篇论文 · 1 个项目");
  await page.screenshot({ path: "test-results/design-preview/dashboard-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: "test-results/design-preview/dashboard-mobile.png", fullPage: true });
});

test("a failed account read shows a retry rather than fabricated zero counts", async ({ page }) => {
  await installApiMocks(page, { signedIn: true });
  await page.route("**/api/cloud/papers", (route) => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/dashboard");
  await expect(page.getByText("暂时无法读取记录")).toBeVisible();
  await expect(page.getByRole("button", { name: "重新加载" })).toBeVisible();
  await expect(page.locator(".overview-footer")).not.toContainText("0 篇论文");
});

test("guest overview provides local reading and does not fetch private records", async ({ page }) => {
  const state = await installApiMocks(page);
  await page.goto("/dashboard");
  await expect(page.getByText("先从一篇论文开始")).toBeVisible();
  await expect(page.getByRole("link", { name: "进入论文研究", exact: true })).toHaveAttribute("href", "/papers");
  expect(state.requests).not.toContain("GET /api/cloud/papers");
  expect(state.requests).not.toContain("GET /api/projects");
});
