import { expect, test } from "@playwright/test";
import { installApiMocks } from "./helpers";

test("COURSE-01 changing course keeps material and uses the selected course for practice", async ({ page }) => {
  await installApiMocks(page);
  await page.addInitScript(() => sessionStorage.setItem("statlab-deepseek-key", "test-only-key"));
  const requests: Array<{ title: string; context: string }> = [];
  await page.route("**/api/papers/ai", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { model: "test-model" } });
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: { result: { questions: [{ type: "简答", difficulty: "基础", question: "如何检查模型假设？", answer: "检查残差和研究设计。", explanation: "结合诊断结果核对假设。" }] } } });
  });
  await page.goto("/courses");
  await expect(page.getByRole("region", { name: "生成的练习" })).toHaveCount(0);
  await page.getByRole("button", { name: "生成本节练习" }).click();
  await expect(page.getByText("请先粘贴或导入一段课程资料，至少约 80 个字符。")).toBeVisible();
  expect(requests).toHaveLength(0);
  const material = "课堂笔记：线性回归需要检查研究设计、变量定义、残差分布以及异方差，不能把观察数据的相关关系直接解释成因果效应。".repeat(3);
  await page.getByLabel("课程资料", { exact: true }).fill(material);
  await page.getByRole("button", { name: /STAT-302 回归分析/ }).click();
  await expect(page.getByRole("heading", { name: "回归分析", exact: true })).toBeVisible();
  await expect(page.getByLabel("课程资料", { exact: true })).toHaveValue(material);
  await page.getByRole("button", { name: "生成本节练习" }).click();
  await expect(page.getByRole("region", { name: "生成的练习" })).toBeVisible();
  await expect(page.getByText("由 AI 生成 · 不是课程原文")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].title).toBe("回归分析");
  expect(requests[0].context).toContain(material);
  await page.getByRole("button", { name: /ECON-301 计量经济学/ }).click();
  await expect(page.getByRole("region", { name: "生成的练习" })).toHaveCount(0);
  await expect(page.getByLabel("课程资料", { exact: true })).toHaveValue(material);
});
