import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateBuildVersion, resolveBuildCommit } from "../scripts/generate-build-version.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("production uses the standard Next.js pipeline", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const pnpmConfig = await read(".npmrc");
  assert.match(packageJson.scripts.dev, /generate-build-version\.mjs && next dev$/);
  assert.match(packageJson.scripts.build, /generate-build-version\.mjs && next build$/);
  assert.equal(packageJson.scripts.start, "next start");
  assert.match(packageJson.scripts["build:sites"], /generate-build-version\.mjs && vinext build$/);
  assert.equal(packageJson.dependencies["@swc/helpers"], "0.5.23");
  assert.match(pnpmConfig, /^node-linker=hoisted$/m);
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
  const generator = await read("scripts/generate-build-version.mjs");
  const packageJson = JSON.parse(await read("package.json"));
  assert.match(route, /Cache-Control["']?,\s*["']no-store, max-age=0/);
  assert.match(version, /BUILD_COMMIT/);
  assert.match(version, /BUILD_TIME/);
  assert.match(version, /BUILD_ENVIRONMENT/);
  assert.match(generator, /rev-parse["'],\s*["']HEAD/);
  assert.doesNotMatch(`${version}\n${generator}`, /commit:\s*["']unknown["']/);
  assert.match(packageJson.scripts.build, /generate-build-version\.mjs/);
  assert.match(await read(".gitignore"), /app\/generated\/build-version\.ts/);
});

test("build metadata generator writes immutable validated identity", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "acaora-build-version-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const outputPath = join(directory, "build-version.ts");
  const commit = "a".repeat(40);
  const now = new Date("2026-08-31T08:00:00.000Z");
  const result = await generateBuildVersion({ outputPath, commit, now, environment: "test" });
  const generated = await readFile(outputPath, "utf8");
  assert.deepEqual(result, { commit, buildTime: now.toISOString(), environment: "test", outputPath });
  assert.match(generated, new RegExp(`BUILD_COMMIT = "${commit}"`));
  assert.match(generated, /BUILD_TIME = "2026-08-31T08:00:00\.000Z"/);
  assert.match(generated, /BUILD_ENVIRONMENT = "test"/);
  assert.doesNotMatch(generated, /unknown/);
  assert.match(resolveBuildCommit({ cwd: fileURLToPath(root) }), /^[0-9a-f]{40,64}$/i);
});

test("Supabase prefers publishable keys and keeps anon only as fallback", async () => {
  const config = await read("app/lib/supabase/config.ts");
  assert.ok(config.indexOf("SUPABASE_PUBLISHABLE_KEY") < config.indexOf("SUPABASE_ANON_KEY"));
  assert.match(config, /SUPABASE_PUBLISHABLE_KEY[\s\S]*\|\|[\s\S]*SUPABASE_ANON_KEY/);
  assert.doesNotMatch(config, /SERVICE_ROLE|SUPABASE_SECRET_KEY/i);
});

test("session refresh stays in supported same-origin route handlers", async () => {
  await assert.rejects(access(new URL("proxy.ts", root)));
  await assert.rejects(access(new URL("app/lib/supabase/proxy.ts", root)));

  const shared = await read("app/api/auth/_shared.ts");
  const server = await read("app/lib/supabase/server.ts");
  assert.match(shared, /createSupabaseServerClient\(\)/);
  assert.match(shared, /supabase\.auth\.getClaims\(\)/);
  assert.match(shared, /supabase\.auth\.getSession\(\)/);
  assert.match(server, /setAll\(cookiesToSet\)/);
  assert.match(server, /httpOnly:\s*true/);
  assert.match(server, /sameSite:\s*"lax"/);
});

test("public environment examples do not contain credentials", async () => {
  const exampleEnv = await read(".env.example");
  assert.doesNotMatch(exampleEnv, /sk-[A-Za-z0-9_-]{12,}/);
  assert.match(exampleEnv, /your-project\.supabase\.co/);
});
