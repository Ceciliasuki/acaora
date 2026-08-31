import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("production uses the standard Next.js pipeline", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal(packageJson.scripts.dev, "next dev");
  assert.equal(packageJson.scripts.build, "next build");
  assert.equal(packageJson.scripts.start, "next start");
  assert.equal(packageJson.scripts["build:sites"], "vinext build");
});

test("authentication has one browser source of truth", async () => {
  await assert.rejects(access(new URL("app/lib/browser-auth.ts", root)));
  const client = await read("app/lib/auth-client.ts");
  assert.match(client, /credentials:\s*"same-origin"/);
  assert.match(client, /localStorage\.removeItem\(legacySessionKey\)/);
  assert.doesNotMatch(client, /supabase\.co/);
});

test("legacy auth URLs redirect to the canonical flow", async () => {
  const config = await read("next.config.ts");
  assert.match(config, /source:\s*"\/auth-callback"[\s\S]*destination:\s*"\/auth\/callback"/);
  assert.match(config, /source:\s*"\/reset"[\s\S]*destination:\s*"\/auth\/reset"/);
});

test("deployment exposes traceable version metadata", async () => {
  const route = await read("app/api/version/route.ts");
  const version = await read("app/lib/version.ts");
  assert.match(route, /Cache-Control["']?,\s*["']no-store, max-age=0/);
  assert.match(version, /ACAORA_COMMIT_SHA/);
  assert.match(version, /ACAORA_BUILD_TIME/);
  assert.match(version, /ACAORA_ENVIRONMENT/);
});

test("public environment examples do not contain credentials", async () => {
  const exampleEnv = await read(".env.example");
  assert.doesNotMatch(exampleEnv, /sk-[A-Za-z0-9_-]{12,}/);
  assert.match(exampleEnv, /your-project\.supabase\.co/);
});
