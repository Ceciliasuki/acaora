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

const continuousPaperFixture = {
  ...longPaperFixture,
  id: 'paper-continuous',
  title: 'Continuous reading paper',
  paragraphs: ['Introduction', 'Methods', 'Results'].map((section, index) => ({
    ...longPaperFixture.paragraphs[0],
    id: `continuous-${index}`,
    page: index + 1,
    section,
    original: `${section}: ${longPaperFixture.paragraphs[0].original}`,
    translation: `${section}译文。`,
    note: `${section}原有笔记。`,
  })),
};

test('PAPER-12 full text scrolls continuously and restores the current paragraph without losing notes', async ({ page }) => {
  await page.setViewportSize({width: 1440, height: 900});
  const state = await installApiMocks(page, {signedIn: true, cloudPapers: [continuousPaperFixture]});
  const sent = () => ([...state.requestBodies].reverse() as typeof continuousPaperFixture[]).find(p => p.id === continuousPaperFixture.id);
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(continuousPaperFixture.title);
  for (const paragraph of continuousPaperFixture.paragraphs) await expect(page.getByText(paragraph.original, {exact: true})).toBeAttached();
  await expect(page.getByRole('button', {name: '下一段', exact: true})).toHaveCount(0);
  const reader = page.getByRole('region', {name: '论文正文', exact: true});
  await reader.hover();
  await page.mouse.wheel(0, 10_000);
  await expect(page.getByLabel('段落笔记')).toHaveValue('Results原有笔记。');
  await page.getByLabel('段落笔记').fill('结果段新笔记。');
  await page.getByRole('button', {name: '显示译文', exact: true}).click();
  await expect(page.getByText('Results译文。', {exact: true})).toBeAttached();
  await expect(page.getByLabel('段落笔记')).toHaveValue('结果段新笔记。');
  await expect.poll(() => sent()?.paragraphs[2].note).toBe('结果段新笔记。');
  await expect.poll(async () => (await readSyncQueue(page)).length).toBe(0);
  await page.reload();
  await expect(page.getByLabel('段落笔记')).toHaveValue('结果段新笔记。');
  await expect.poll(() => reader.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.locator('.section-chips').getByRole('button', {name: 'Methods', exact: true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Methods原有笔记。');
  await page.getByRole('button', {name: '☆ 收藏', exact: true}).click();
  await expect.poll(() => sent()?.paragraphs[1].bookmarked).toBe(true);
  expect(sent()?.paragraphs[2].note).toBe('结果段新笔记。');
  expect(sent()?.paragraphs.every(p => !p.read)).toBe(true);
  await reader.screenshot({path: 'outputs/continuous-paper-reader-desktop.png'});
});

test('PAPER-13 mobile full-text scrolling keeps notes attached to the reading position', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await installApiMocks(page, {signedIn: true, cloudPapers: [continuousPaperFixture]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(continuousPaperFixture.title);
  for (const paragraph of continuousPaperFixture.paragraphs) await expect(page.getByText(paragraph.original, {exact: true})).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const panels = page.getByRole('tablist', {name: '论文工作台面板'});
  await expect(panels).toBeInViewport();
  const libraryTab = await panels.getByRole('tab', {name: '论文库', exact: true}).boundingBox();
  const menu = await page.getByRole('button', {name: '打开主导航', exact: true}).boundingBox();
  expect(libraryTab!.x).toBeGreaterThanOrEqual(menu!.x + menu!.width);
  expect(libraryTab!.height).toBeGreaterThanOrEqual(44);
  await panels.getByRole('tab', {name: '笔记', exact: true}).click();
  await expect(page.getByLabel('段落笔记')).toHaveValue('Results原有笔记。');
  await page.getByLabel('段落笔记').fill('手机全文笔记。');
  await panels.getByRole('tab', {name: '阅读', exact: true}).click();
  await expect(page.getByText(continuousPaperFixture.paragraphs[2].original, {exact: true})).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await page.screenshot({path: 'outputs/continuous-paper-reader-mobile.png'});
});

test('PAPER-14 delayed translation preserves later reading and notes and cannot reopen a different paper', async ({page}) => {
  await page.addInitScript(() => {
    const local = window as typeof window & {Translator?: unknown; finishTranslation?: (text: string) => void; translationCalls?: number};
    local.translationCalls = 0;
    local.Translator = {availability: async () => 'available', create: async () => ({translate: () => new Promise<string>(resolve => {local.translationCalls!++; local.finishTranslation = resolve;})})};
  });
  await installApiMocks(page, {signedIn: true, cloudPapers: [continuousPaperFixture, paperFixture]});
  await page.goto('/papers');
  await expect(page.getByLabel('论文标题')).toHaveValue(continuousPaperFixture.title);
  await page.getByRole('button', {name: '翻译当前段落', exact: true}).click();
  await expect(page.getByText('设备端翻译进行中', {exact: true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {translationCalls?: number}).translationCalls)).toBe(1);
  await page.getByRole('region', {name: '论文正文', exact: true}).hover();
  await page.mouse.wheel(0, 10_000);
  await expect(page.getByLabel('段落笔记')).toHaveValue('Results原有笔记。');
  await page.getByLabel('段落笔记').fill('翻译期间新笔记。');
  await page.evaluate(() => (window as typeof window & {finishTranslation: (text: string) => void}).finishTranslation('已完成首段翻译。'));
  await expect(page.getByText('本地翻译已完成', {exact: true})).toBeVisible();
  await expect(page.getByLabel('段落笔记')).toHaveValue('翻译期间新笔记。');
  await page.getByRole('button', {name: '翻译当前段落', exact: true}).click();
  await expect(page.getByText('设备端翻译进行中', {exact: true})).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as typeof window & {translationCalls?: number}).translationCalls)).toBe(2);
  await page.getByRole('button', {name: `${paperFixture.title} 1 段 · 已读 0%`, exact: true}).click();
  await expect(page.getByLabel('论文标题')).toHaveValue(paperFixture.title);
  await page.evaluate(() => (window as typeof window & {finishTranslation: (text: string) => void}).finishTranslation('另一篇的过期翻译。'));
  await expect(page.getByText('设备端翻译进行中', {exact: true})).toBeHidden();
  await expect(page.getByLabel('论文标题')).toHaveValue(paperFixture.title);
  await expect(page.getByLabel('段落笔记')).toHaveValue(paperFixture.paragraphs[0].note);
});

test("PAPER-10 a long paper stays bounded and switches to an unobstructed AI mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installApiMocks(page, { signedIn: true, cloudPapers: [longPaperFixture] });
  await page.goto("/papers");
  await expect(page.getByText(longPaperFixture.title, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "AI 分析", exact: true })).toBeHidden();

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
      readerScrolls: scroll.scrollHeight > scroll.clientHeight,
    };
  });

  // Long content must stay in its own scroll pane while the tool mode changes.
  for (const column of ["reader", "index", "rail"] as const) {
    expect(regions[column].bottom, `${column} 越过了 workbench 下边界`).toBeLessThanOrEqual(regions.workbench.bottom + 1);
  }
  await page.getByLabel("段落笔记").fill("核对研究设计与因果结论。");
  await page.getByRole("navigation", { name: "论文工作模式" }).getByRole("button", { name: "AI 分析", exact: true }).click();
  await expect(page.locator(".plab-workbench")).toBeHidden();
  await expect(page.getByRole("heading", { name: "AI 分析", exact: true })).toBeVisible();

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
  await page.screenshot({ path: "test-results/papers-ai-desktop.png" });
  await page.getByRole("navigation", { name: "论文工作模式" }).getByRole("button", { name: "学术检索", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "论文检索关键词" })).toBeVisible();
  await expect(page.locator(".ai-studio")).toBeHidden();
  await page.screenshot({ path: "test-results/papers-search-desktop.png" });
  await page.getByRole("navigation", { name: "论文工作模式" }).getByRole("button", { name: "阅读与笔记", exact: true }).click();
  await expect(page.getByLabel("段落笔记")).toHaveValue("核对研究设计与因果结论。");
  await expect(page.getByLabel("论文标题")).toHaveValue(longPaperFixture.title);

  // If the paper stops over-filling the reader this case silently stops covering
  // the bug it was written for, so the fixture's length is asserted too.
  expect(regions.readerScrolls, "测试论文没有撑满阅读器，用例已失去意义").toBe(true);
});

test("PAPER-11 mobile modes retain notes and return to the selected paragraph", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture] });
  await page.goto("/papers");
  await expect(page.getByLabel("论文标题")).toHaveValue(paperFixture.title);
  const toolbar = await page.locator(".plab-reader-bar").boundingBox();
  const next = await page.getByRole("button", { name: "显示译文", exact: true }).boundingBox();
  expect(toolbar).not.toBeNull();
  expect(next).not.toBeNull();
  expect(next!.x + next!.width, "译文开关越过了移动端工具栏").toBeLessThanOrEqual(toolbar!.x + toolbar!.width + 1);
  const panels = page.getByRole("tablist", { name: "论文工作台面板" });
  await panels.getByRole("tab", { name: "笔记", exact: true }).click();
  await page.getByLabel("段落笔记").fill("移动端笔记。");
  await panels.getByRole("tab", { name: "AI", exact: true }).click();
  await expect(page.getByRole("heading", { name: "AI 分析", exact: true })).toBeVisible();
  await expect(page.getByLabel("段落笔记")).toBeHidden();
  await panels.getByRole("tab", { name: "检索", exact: true }).click();
  await expect(page.getByLabel("论文检索关键词")).toBeVisible();
  await panels.getByRole("tab", { name: "笔记", exact: true }).click();
  await expect(page.getByLabel("段落笔记")).toHaveValue("移动端笔记。");
  await panels.getByRole("tab", { name: "阅读", exact: true }).click();
  await expect(page.getByLabel("论文标题")).toHaveValue(paperFixture.title);
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
