import { expect, test } from "@playwright/test";
import { installApiMocks, makeTextPdf } from "./helpers";

test("PAPER-01 imports and parses a text PDF locally", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "reproducible-study.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect(page.getByText(/已读取 \d+ 个段落，原始 PDF 未上传。/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("reproducible-study.pdf", { exact: true })).toBeVisible();
  await expect.poll(() => state.requests.includes("PUT /api/cloud/papers")).toBe(true);
});
