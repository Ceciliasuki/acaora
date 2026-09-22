import { expect, test } from "@playwright/test";
import { installApiMocks, makeTextPdf } from "./helpers";

const paperFixture = {
  id: "paper-cloud",
  fileName: "cloud-paper.pdf",
  title: "Cloud paper memory",
  addedAt: 1_788_912_000_000,
  updatedAt: 1_788_912_000_000,
  activeParagraph: 0,
  paragraphs: [{
    id: "cloud-p1",
    page: 1,
    section: "Abstract",
    original: "A complete cloud paper fixture.",
    translation: "完整的云端论文测试记录。",
    note: "",
    bookmarked: false,
    read: false,
  }],
};

test("PAPER-01 imports and parses a text PDF locally", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "reproducible-study.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect(page.getByText(/已读取 \d+ 个段落，原始 PDF 未上传。/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("reproducible-study.pdf", { exact: true })).toBeVisible();
  await expect.poll(() => state.requests.includes("PUT /api/cloud/papers")).toBe(true);
});

test("PAPER-02 failed upload remains queued across reload", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, failPaperSync: true });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "queued.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect(page.getByText(/云同步暂不可用/)).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByText("queued.pdf", { exact: true })).toBeVisible();
  const queuedIds = await readSyncQueue(page);
  expect(queuedIds.map((operation) => operation.id)).toHaveLength(1);
  expect(queuedIds[0].type).toBe("upsert");
  state.failPaperSync = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => state.requests.filter((request) => request === "PUT /api/cloud/papers").length).toBeGreaterThan(1);
  await expect.poll(async () => (await readSyncQueue(page)).length).toBe(0);
});

test("PAPER-03 signed-in delete is durably queued before cloud acknowledgement", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture], failPaperDelete: true });
  await page.goto("/papers");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `删除 ${paperFixture.title}` }).click();
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  const operations = await readSyncQueue(page);
  expect(operations.find((operation) => operation.id === paperFixture.id)?.type).toBe("delete");
  await page.reload();
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  state.failPaperDelete = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await readSyncQueue(page)).length).toBe(0);
  expect(state.cloudDeletions.some((item) => item.id === paperFixture.id)).toBe(true);
});

test("PAPER-04 cloud tombstone removes local paper and pending upsert", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture] });
  await page.goto("/papers");
  await expect(page.getByText(paperFixture.title, { exact: true })).toBeVisible();
  state.cloudPapers = [];
  state.cloudDeletions.push({ id: paperFixture.id, deletedAt: Date.now() });
  await page.reload();
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  expect((await readSyncQueue(page)).some((item) => item.id === paperFixture.id)).toBe(false);
});

test("PAPER-05 deletion confirmation distinguishes all devices from this device", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture] });
  await page.goto("/papers");
  const signedInDialog = page.waitForEvent("dialog");
  const signedInClick = page.getByRole("button", { name: `删除 ${paperFixture.title}` }).click();
  const first = await signedInDialog;
  expect(first.message()).toBe(`从所有设备删除“${paperFixture.title}”的论文记忆？原始 PDF 不受影响；提取文本、翻译、笔记、阅读进度和 AI 结果将被删除。`);
  await first.dismiss();
  await signedInClick;
  state.signedIn = false;
  const guestPaper = { ...paperFixture, id: "guest-paper", title: "Guest paper memory" };
  await page.evaluate(async (record) => {
    const request = indexedDB.open("statlab-paper-memory", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("papers", "readwrite");
      transaction.objectStore("papers").put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, guestPaper);
  await page.reload();
  const guestDialog = page.waitForEvent("dialog");
  const guestClick = page.getByRole("button", { name: `删除 ${guestPaper.title}` }).click();
  const second = await guestDialog;
  expect(second.message()).toBe(`从当前设备删除“${guestPaper.title}”的论文记忆？原始 PDF 不受影响。`);
  await second.dismiss();
  await guestClick;
});

test("PAPER-06 account switch does not expose or upload another account's local papers", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, userId: "account-a", cloudPapers: [paperFixture] });
  await page.goto("/papers");
  await expect(page.getByText(paperFixture.title, { exact: true })).toBeVisible();
  state.userId = "account-b";
  state.cloudPapers = [];
  const writesBefore = state.requests.filter((request) => request === "PUT /api/cloud/papers").length;
  await page.reload();
  await expect.poll(() => state.requests.filter((request) => request === "GET /api/cloud/papers").length).toBeGreaterThan(1);
  await expect(page.locator(".library-privacy strong")).not.toHaveText("正在检查账户");
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  expect(state.requests.filter((request) => request === "PUT /api/cloud/papers").length).toBe(writesBefore);
});

test("PAPER-07 edit during an in-flight upload remains queued until the newer version is sent", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, paperSyncDelayMs: 1_000 });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "race.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect.poll(() => state.requests.filter((request) => request === "PUT /api/cloud/papers").length).toBeGreaterThan(0);
  await page.getByRole("textbox", { name: "论文标题" }).fill("Edited while uploading");
  await expect.poll(() => state.requestBodies.some((body) => (body as { title?: string }).title === "Edited while uploading"), { timeout: 10_000 }).toBe(true);
  await expect.poll(async () => (await readSyncQueue(page)).length, { timeout: 10_000 }).toBe(0);
});

test("PAPER-08 oversized memory stays local and does not retry until edited", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, paperSyncStatus: 413 });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "large.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect.poll(async () => (await readSyncQueue(page))[0]?.blockedReason).toBe("too-large");
  const writesBefore = state.requests.filter((request) => request === "PUT /api/cloud/papers").length;
  await page.reload();
  await expect(page.getByText("large.pdf", { exact: true })).toBeVisible();
  await expect(page.locator(".library-privacy strong")).toHaveText("云同步暂不可用");
  expect(state.requests.filter((request) => request === "PUT /api/cloud/papers").length).toBe(writesBefore);
  state.paperSyncStatus = 200;
  await page.getByRole("textbox", { name: "论文标题" }).fill("Revised local memory");
  await expect.poll(async () => (await readSyncQueue(page)).length, { timeout: 10_000 }).toBe(0);
  expect(state.requests.filter((request) => request === "PUT /api/cloud/papers").length).toBeGreaterThan(writesBefore);
});

test("PAPER-09 offline deletion survives reload and reaches cloud after reconnect", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture] });
  await page.goto("/papers");
  await expect(page.getByText(paperFixture.title, { exact: true })).toBeVisible();
  await page.context().setOffline(true);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `删除 ${paperFixture.title}` }).click();
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  expect((await readSyncQueue(page)).find((operation) => operation.id === paperFixture.id)?.type).toBe("delete");
  await page.context().setOffline(false);
  await page.reload();
  await expect.poll(() => state.requests.filter((request) => request === "GET /api/cloud/papers").length).toBeGreaterThan(1);
  await expect(page.locator(".library-privacy strong")).not.toHaveText("正在检查账户");
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(async () => (await readSyncQueue(page)).length).toBe(0);
  expect(state.cloudDeletions.some((deletion) => deletion.id === paperFixture.id)).toBe(true);
});

/* The reader only overflows its column once a paper's active paragraph is taller
   than the workbench, so the built-in sample — the state every other PaperLab
   test and the visual baseline capture — never reaches the layout these
   assertions describe. This fixture is deliberately long enough to get there. */
const longPaperFixture = {
  id: "paper-long",
  fileName: "long-paper.pdf",
  title: "Long paper memory",
  addedAt: 1_788_912_000_000,
  updatedAt: 1_788_912_000_000,
  activeParagraph: 0,
  paragraphs: [{
    id: "long-p1",
    page: 1,
    section: "Abstract",
    original: "Statistical learning methods are widely used to identify patterns in complex observational data. Careful validation is essential because apparent predictive performance may not generalize to new populations, and the study design determines which causal claims the evidence can support. ".repeat(6),
    translation: "统计学习方法被广泛用于识别复杂观察数据中的模式。谨慎的验证至关重要，因为表面上的预测性能可能无法推广到新的人群，而研究设计决定了证据能够支持哪些因果结论。".repeat(3),
    note: "",
    bookmarked: false,
    read: false,
  }],
};

test("PAPER-10 a long paper keeps the reader inside the workbench and clear of the AI console", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page, { signedIn: true, cloudPapers: [longPaperFixture] });
  await page.goto("/papers");
  await expect(page.getByText(longPaperFixture.title, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 研究控制台" })).toBeVisible();

  const regions = await page.evaluate(() => {
    function edges(selector: string) {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { top: Math.round(rect.top), bottom: Math.round(rect.bottom) };
    }
    const scroll = document.querySelector(".plab-reader-scroll") as HTMLElement;
    return {
      workbench: edges(".plab-workbench"),
      reader: edges(".plab-reader"),
      index: edges(".plab-index"),
      rail: edges(".plab-rail"),
      console: edges(".ai-studio"),
      readerScrolls: scroll.scrollHeight > scroll.clientHeight,
    };
  });

  /* The bounded reading region is what keeps the three columns apart from the
     console, so the invariant is that no column grows past it. While the reader
     was allowed to size to its content, all three stretched past this edge. */
  for (const column of ["reader", "index", "rail"] as const) {
    expect(regions[column].bottom, `${column} 越过了 workbench 下边界`).toBeLessThanOrEqual(regions.workbench.bottom + 1);
  }
  expect(regions.console.top, "AI 控制台与阅读器重叠").toBeGreaterThanOrEqual(regions.reader.bottom - 1);
  expect(regions.console.top, "AI 控制台与 workbench 重叠").toBeGreaterThanOrEqual(regions.workbench.bottom - 1);

  // Geometry is not the whole symptom: the console's own band has to be painted
  // by the console, not by a column spilling over it.
  await page.locator(".ai-studio").scrollIntoViewIfNeeded();
  const covered = await page.evaluate(() => {
    const section = document.querySelector(".ai-studio");
    if (!section) throw new Error("missing .ai-studio");
    const rect = section.getBoundingClientRect();
    const top = Math.max(rect.top + 4, 2);
    const bottom = Math.min(rect.bottom - 4, window.innerHeight - 2);
    const foreign = new Set<string>();
    for (let row = 0; row < 4; row += 1) {
      const y = Math.round(top + ((bottom - top) * row) / 3);
      for (let column = 0; column <= 10; column += 1) {
        const x = Math.round(rect.left + 4 + ((rect.width - 8) * column) / 10);
        const hit = document.elementFromPoint(x, y);
        if (!hit || section.contains(hit) || hit.tagName === "NEXTJS-PORTAL" || hit.closest(".student-sidebar")) continue;
        foreign.add(`${hit.tagName.toLowerCase()}.${String((hit as HTMLElement).className || "")}`);
      }
    }
    return [...foreign];
  });
  expect(covered, "AI 控制台被其他区域覆盖").toEqual([]);

  // If the paper stops over-filling the reader this case silently stops covering
  // the bug it was written for, so the fixture's length is asserted too.
  expect(regions.readerScrolls, "测试论文没有撑满阅读器，用例已失去意义").toBe(true);
});

async function readSyncQueue(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const request = indexedDB.open("statlab-paper-memory", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("paper-sync-operations", "readonly");
    const getAll = transaction.objectStore("paper-sync-operations").getAll();
    const result = await new Promise<Array<{ id: string; type: string; blockedReason?: string }>>((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    });
    database.close();
    return result;
  });
}
