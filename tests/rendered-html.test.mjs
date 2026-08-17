import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Acaora product page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Acaora 学曦 · 大学生智能学习与研究平台<\/title>/i);
  assert.match(html, /Acaora/);
  assert.match(html, /论文研究/);
  assert.match(html, /数据分析/);
  assert.doesNotMatch(html, /codex-preview|Building your site|Starter Project/i);
});

test("keeps public deployment metadata free of secrets", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));
  const [hosting, exampleEnv] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);

  const config = JSON.parse(hosting);
  assert.equal(typeof config.project_id, "string");
  assert.doesNotMatch(exampleEnv, /sk-[A-Za-z0-9_-]{12,}/);
  assert.match(exampleEnv, /your-project\.supabase\.co/);
});
