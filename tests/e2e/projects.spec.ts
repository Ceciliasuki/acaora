import { expect, test } from "@playwright/test";
import { installApiMocks } from "./helpers";

test("PROJECT-01 create, edit, add task, and refresh persists", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true });
  await page.goto("/projects");
  await page.getByLabel("项目名称").fill("睡眠与学习研究");
  await page.getByLabel("希望完成什么？").fill("完成一份可复核的回归分析报告");
  await page.getByRole("button", { name: "创建项目空间" }).click();
  await expect(page.getByRole("heading", { name: "睡眠与学习研究" })).toBeVisible();

  await page.getByLabel("新任务").fill("整理变量字典");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.locator(".project-tasks").getByText("整理变量字典", { exact: true })).toBeVisible();
  await page.locator("#project-notes").fill("先检查缺失值，再拟合模型。");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.getByText("项目笔记已保存。")).toBeVisible();

  await page.reload();
  await expect(page.locator(".project-tasks").getByText("整理变量字典", { exact: true })).toBeVisible();
  await expect(page.locator("#project-notes")).toHaveValue("先检查缺失值，再拟合模型。");
  expect(state.projects).toHaveLength(1);
});

test("PROJECT-02 authenticated project deletion", async ({ page }) => {
  const now = "2026-08-16T08:00:00.000Z";
  const state = await installApiMocks(page, { signedIn: true, projects: [{ id: "project-delete", title: "待删除项目", kind: "paper", status: "active", metadata: { tasks: [] }, created_at: now, updated_at: now }] });
  await page.goto("/projects");
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "删除这个项目？" })).toBeVisible();
  await page.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("项目已删除。")).toBeVisible();
  expect(state.projects).toHaveLength(0);
  expect(state.requests).toContain("DELETE /api/projects");
});
