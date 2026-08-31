import { expect, test } from "@playwright/test";
import { installApiMocks, login, type MockState } from "./helpers";

let state: MockState;
test.beforeEach(async ({ page }) => {
  state = await installApiMocks(page);
});

test("AUTH-01 registration reuses consistent PasswordField controls", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("tab", { name: "注册账户" }).click();
  const password = page.locator("#account-password");
  const confirmation = page.locator("#confirm-password");
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await expect(confirmation).toHaveAttribute("autocomplete", "new-password");
  const [firstBox, secondBox] = await Promise.all([password.boundingBox(), confirmation.boundingBox()]);
  expect(firstBox?.height).toBe(secondBox?.height);
  await password.fill("ValidPass1");
  await confirmation.fill("Different2A");
  await expect(page.getByText("两次输入的密码不一致。")).toBeVisible();
});

test("AUTH-02 login succeeds and redirects to Dashboard", async ({ page }) => {
  await login(page);
  await expect(page.getByText("工作台还是空的")).toBeVisible();
});

test("AUTH-03 login survives a Dashboard refresh", async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole("heading", { name: "你好，student。" })).toBeVisible();
  await expect(page.getByText("工作台还是空的")).toBeVisible();
});

test("AUTH-04 workspace logo returns to Dashboard without losing identity", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "返回 Acaora 工作台" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "你好，student。" })).toBeVisible();
});

test("AUTH-05 all workspace navigation preserves the session", async ({ page }) => {
  await login(page);
  const destinations = [
    ["课程中心", /\/courses$/],
    ["论文研究", /\/papers$/],
    ["数据分析", /\/data$/],
    ["项目空间", /\/projects$/],
    ["设置与隐私", /\/settings$/],
  ] as const;
  for (const [name, pathname] of destinations) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(pathname);
    if (name === "项目空间") await page.getByRole("button", { name: "关闭", exact: true }).click();
  }
  await expect(page.getByText("测试同学", { exact: true })).toBeVisible();
});

test("AUTH-06 password update, logout, and new-password login", async ({ page }) => {
  await login(page);
  await page.goto("/settings#security");
  await page.locator("#settings-new-password").fill("NewValidPass2");
  await page.locator("#settings-confirm-password").fill("NewValidPass2");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByText("登录密码已更新。")).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/$/);
  await login(page, "NewValidPass2");
});

test("AUTH-07 failed login explains the error and allows retry", async ({ page }) => {
  state.failNextLogin = true;
  await page.goto("/auth");
  await page.getByLabel("邮箱地址").fill("student@example.com");
  await page.locator("#account-password").fill("ValidPass1");
  await page.getByRole("button", { name: "登录账户" }).click();
  await expect(page.getByText("邮箱或密码错误，请检查后重试。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "登录账户" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(state.requests.filter((item) => item === "POST /api/auth/login")).toHaveLength(2);
});

test("AUTH-08 recovery uses the same-origin canonical API flow", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "忘记密码？" }).click();
  await page.getByLabel("邮箱地址").fill("student@example.com");
  await page.getByRole("button", { name: "发送重置链接" }).click();
  await expect(page.getByText("密码设置链接已发送至")).toBeVisible();
  expect(state.requests).toContain("POST /api/auth/recover");
  expect(state.requests.some((request) => request.includes("supabase.co"))).toBe(false);
});
