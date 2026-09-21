# Paper Cloud Sync Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PaperLab edits and deletions survive offline periods and synchronize safely across devices without allowing deleted records to reappear.

**Architecture:** Add content-clearing cloud tombstones and atomic authenticated RPC functions in Supabase, plus one durable collapsed-operation queue in IndexedDB. Keep reconciliation and retry decisions in a pure module, expose them through the existing same-origin API, and let the Paper page coordinate lifecycle and user feedback.

**Tech Stack:** Next.js 16.3.1, React 19.2.6, TypeScript 5.9.3, IndexedDB, Supabase/PostgreSQL RLS, Node test runner, Playwright 1.62.1, axe.

**Spec:** `docs/superpowers/specs/2026-09-09-paper-cloud-sync-reliability-design.md`

## Global Constraints

- Original PDF bytes remain local and must never enter IndexedDB paper records, the sync queue, API bodies, or Supabase.
- Browser code may use `SUPABASE_PUBLISHABLE_KEY` through same-origin server routes only; no service-role or secret key may be introduced.
- Every cloud operation derives the user from `auth.uid()` and remains protected by RLS.
- Signed-in deletion clears paper content in Supabase and propagates to all devices; guest deletion remains device-only.
- A cloud tombstone always wins for its paper ID, regardless of client clock skew.
- Existing 1,500,000-character cloud payload protection and private/no-store API headers remain intact.
- Do not apply the database migration, deploy, delete user data, or change Production environment variables during implementation.
- Repository runtime remains Node 22.11.0 and pnpm 10.26.1.
- Git author identity must be explicitly configured by the owner before any commit command is executed; do not invent an identity.

---

### Task 1: Add the Cloud Tombstone Migration

**Files:**
- Create: `supabase/migrations/0005_paper_sync_tombstones.sql`
- Modify: `tests/source-invariants.test.mjs`

**Interfaces:**
- Consumes: existing `public.paper_memories` primary key `(user_id, id)` and authenticated RLS policies.
- Produces: nullable `deleted_at`; `public.sync_paper_memory(text, text, text, jsonb, jsonb, timestamptz)`; and `public.delete_paper_memory(text)`, with both functions returning JSON status objects.

- [ ] **Step 1: Write the failing migration contract test**

Add this test to `tests/source-invariants.test.mjs`:

```js
test("paper sync migration uses authenticated atomic writes and content-clearing tombstones", async () => {
  const migration = await read("supabase/migrations/0005_paper_sync_tombstones.sql");
  assert.match(migration, /add column if not exists deleted_at timestamptz/);
  assert.match(migration, /create or replace function public\.sync_paper_memory/);
  assert.match(migration, /create or replace function public\.delete_paper_memory/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /extracted_content\s*=\s*'\{\}'::jsonb/);
  assert.match(migration, /ai_memory\s*=\s*'\{\}'::jsonb/);
  assert.match(migration, /revoke execute[\s\S]*from public, anon/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/source-invariants.test.mjs`

Expected: FAIL because `0005_paper_sync_tombstones.sql` does not exist.

- [ ] **Step 3: Implement the additive migration**

Create SQL with this structure:

```sql
alter table public.paper_memories
  add column if not exists deleted_at timestamptz;

create index if not exists paper_memories_user_updated_idx
  on public.paper_memories (user_id, updated_at desc);

create or replace function public.sync_paper_memory(
  p_id text,
  p_title text,
  p_file_name text,
  p_extracted_content jsonb,
  p_ai_memory jsonb,
  p_updated_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  affected integer;
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.paper_memories
    (id, user_id, title, file_name, extracted_content, ai_memory, updated_at, deleted_at)
  values
    (p_id, current_user_id, p_title, p_file_name, p_extracted_content, p_ai_memory, p_updated_at, null)
  on conflict (user_id, id) do update set
    title = excluded.title,
    file_name = excluded.file_name,
    extracted_content = excluded.extracted_content,
    ai_memory = excluded.ai_memory,
    updated_at = excluded.updated_at
  where public.paper_memories.deleted_at is null
    and public.paper_memories.updated_at <= excluded.updated_at;
  get diagnostics affected = row_count;
  return jsonb_build_object('status', case when affected = 1 then 'synced' else 'stale' end);
end;
$$;

create or replace function public.delete_paper_memory(p_id text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  deletion_time timestamptz := clock_timestamp();
begin
  if current_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.paper_memories
    (id, user_id, title, file_name, extracted_content, ai_memory, updated_at, deleted_at)
  values
    (p_id, current_user_id, '[deleted]', '', '{}'::jsonb, '{}'::jsonb, deletion_time, deletion_time)
  on conflict (user_id, id) do update set
    title = '[deleted]',
    file_name = '',
    extracted_content = '{}'::jsonb,
    ai_memory = '{}'::jsonb,
    updated_at = deletion_time,
    deleted_at = deletion_time;
  return jsonb_build_object(
    'status', 'deleted',
    'deletedAt', extract(epoch from deletion_time) * 1000
  );
end;
$$;

revoke execute on function public.sync_paper_memory(text, text, text, jsonb, jsonb, timestamptz) from public, anon;
revoke execute on function public.delete_paper_memory(text) from public, anon;
grant execute on function public.sync_paper_memory(text, text, text, jsonb, jsonb, timestamptz) to authenticated;
grant execute on function public.delete_paper_memory(text) to authenticated;
```

- [ ] **Step 4: Verify migration contract GREEN**

Run: `node --test tests/source-invariants.test.mjs`

Expected: every source invariant passes.

- [ ] **Step 5: Review SQL without applying it**

Run: `git diff --check -- supabase/migrations/0005_paper_sync_tombstones.sql tests/source-invariants.test.mjs`

Expected: exit 0. Confirm no command has contacted or modified Supabase.

- [ ] **Step 6: Commit after owner identity is configured**

```bash
git add supabase/migrations/0005_paper_sync_tombstones.sql tests/source-invariants.test.mjs
git commit -m "feat: add paper sync tombstones"
```

---

### Task 2: Define Pure Reconciliation and Retry Rules

**Files:**
- Create: `app/papers/paper-sync.mjs`
- Create: `app/papers/paper-sync.d.mts`
- Create: `tests/paper-sync.test.mjs`
- Modify: `app/papers/paper-types.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `PaperRecord` values with `id` and numeric `updatedAt`.
- Produces: `collapseOperation(existing, incoming)`, `reconcileSnapshot(input)`, `retryDecision(status, attempts, online)`, and `nextRetryDelay(attempts)`.

- [ ] **Step 1: Add failing pure-rule tests**

Create `tests/paper-sync.test.mjs` with literal fixtures covering these assertions:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { collapseOperation, nextRetryDelay, reconcileSnapshot, retryDecision } from "../app/papers/paper-sync.mjs";

const local = { id: "paper-1", title: "local", updatedAt: 200 };
const cloud = { id: "paper-1", title: "cloud", updatedAt: 100 };

test("a delete supersedes a queued upsert", () => {
  assert.deepEqual(
    collapseOperation({ id: "paper-1", type: "upsert", updatedAt: 200, paper: local, attempts: 0, nextAttemptAt: 0 }, { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 }),
    { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 },
  );
});

test("a cloud tombstone removes local content and queued upserts", () => {
  assert.deepEqual(reconcileSnapshot({ localPapers: [local], cloudPapers: [], deletions: [{ id: "paper-1", deletedAt: 300 }], pending: [{ id: "paper-1", type: "upsert", updatedAt: 200, paper: local, attempts: 0, nextAttemptAt: 0 }] }), { papers: [], pending: [] });
});

test("local newer than cloud is retained and queued", () => {
  const result = reconcileSnapshot({ localPapers: [local], cloudPapers: [cloud], deletions: [], pending: [] });
  assert.equal(result.papers[0].title, "local");
  assert.equal(result.pending[0].type, "upsert");
});

test("cloud newer than local replaces the local record", () => {
  const result = reconcileSnapshot({ localPapers: [cloud], cloudPapers: [local], deletions: [], pending: [] });
  assert.equal(result.papers[0].title, "local");
  assert.deepEqual(result.pending, []);
});

test("retry policy pauses auth, reconciles conflicts, and stops oversized payload retries", () => {
  assert.equal(retryDecision(401, 0, true), "pause-auth");
  assert.equal(retryDecision(409, 0, true), "refresh-cloud");
  assert.equal(retryDecision(413, 0, true), "non-retryable");
  assert.equal(retryDecision(503, 2, true), "retry");
  assert.equal(retryDecision(503, 2, false), "pause-offline");
});

test("retry delay caps at sixty seconds", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(nextRetryDelay), [1000, 2000, 4000, 8000, 16000, 32000, 60000]);
});
```

- [ ] **Step 2: Run the pure tests and verify RED**

Run: `node --test tests/paper-sync.test.mjs`

Expected: FAIL because `paper-sync.mjs` does not exist.

- [ ] **Step 3: Implement the minimal pure module and declarations**

Implement the following contracts:

```js
export function collapseOperation(existing, incoming) {
  if (!existing) return incoming;
  if (existing.type === "delete") return existing;
  if (incoming.type === "delete") return incoming;
  return incoming.updatedAt >= existing.updatedAt ? incoming : existing;
}

export function nextRetryDelay(attempts) {
  return Math.min(60_000, 1_000 * (2 ** attempts));
}

export function retryDecision(status, attempts, online) {
  if (!online) return "pause-offline";
  if (status === 401) return "pause-auth";
  if (status === 409) return "refresh-cloud";
  if (status === 413) return "non-retryable";
  if (status >= 500 || status === 408 || status === 429) return "retry";
  return status >= 200 && status < 300 ? "complete" : "non-retryable";
}
```

Implement `reconcileSnapshot` with this ordering:

```js
export function reconcileSnapshot({ localPapers, cloudPapers, deletions, pending }) {
  const deletedIds = new Set(deletions.map((item) => item.id));
  const cloudById = new Map(cloudPapers.filter((paper) => !deletedIds.has(paper.id)).map((paper) => [paper.id, paper]));
  const paperById = new Map(cloudById);
  const operationById = new Map(pending.filter((operation) => operation.type === "delete").map((operation) => [operation.id, operation]));

  for (const paper of localPapers) {
    if (deletedIds.has(paper.id) || operationById.get(paper.id)?.type === "delete") continue;
    const cloudPaper = cloudById.get(paper.id);
    if (!cloudPaper || paper.updatedAt > cloudPaper.updatedAt) {
      paperById.set(paper.id, paper);
      operationById.set(paper.id, collapseOperation(operationById.get(paper.id), {
        id: paper.id,
        type: "upsert",
        updatedAt: paper.updatedAt,
        paper,
        attempts: 0,
        nextAttemptAt: 0,
      }));
    }
  }

  return {
    papers: [...paperById.values()].sort((left, right) => right.updatedAt - left.updatedAt),
    pending: [...operationById.values()],
  };
}
```

Add `CloudDeletion` and `PaperSyncOperation` to `paper-types.ts`, then add matching exported TypeScript declarations in `paper-sync.d.mts` using those types and `PaperRecord`.

- [ ] **Step 4: Add the test to the unit command and verify GREEN**

Change `package.json`:

```json
"test:unit": "node --test tests/source-invariants.test.mjs tests/paper-sync.test.mjs"
```

Run: `node --test tests/source-invariants.test.mjs tests/paper-sync.test.mjs`

Expected: all source and pure-rule tests pass.

- [ ] **Step 5: Commit after owner identity is configured**

```bash
git add app/papers/paper-sync.mjs app/papers/paper-sync.d.mts app/papers/paper-types.ts tests/paper-sync.test.mjs package.json
git commit -m "test: define paper sync reconciliation rules"
```

---

### Task 3: Upgrade IndexedDB to a Durable Operation Queue

**Files:**
- Modify: `app/papers/paper-storage.ts`
- Modify: `tests/e2e/papers.spec.ts`
- Modify: `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: `PaperRecord` and collapsed operations from Task 2.
- Produces: `savePaperAndQueue`, `deletePaperAndQueue`, `getPaperSyncOperations`, `putPaperSyncOperation`, and `deletePaperSyncOperation`.

- [ ] **Step 1: Add failing Playwright persistence cases**

Extend the mock state with `failPaperSync`, `cloudDeletions`, and captured request bodies. Add tests that:

```ts
test("PAPER-02 failed upload remains queued across reload", async ({ page }) => {
  const state = await installApiMocks(page, { signedIn: true, failPaperSync: true });
  await page.goto("/papers");
  await page.locator('input[type="file"]').setInputFiles({ name: "queued.pdf", mimeType: "application/pdf", buffer: makeTextPdf() });
  await expect(page.getByText(/等待同步|云同步暂不可用/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("queued.pdf", { exact: true })).toBeVisible();
  const queuedIds = await page.evaluate(async () => {
    const request = indexedDB.open("statlab-paper-memory", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("paper-sync-operations", "readonly");
    const getAll = transaction.objectStore("paper-sync-operations").getAllKeys();
    return new Promise<IDBValidKey[]>((resolve, reject) => {
      getAll.onsuccess = () => resolve(getAll.result);
      getAll.onerror = () => reject(getAll.error);
    });
  });
  expect(queuedIds).toHaveLength(1);
});

test("PAPER-03 signed-in delete is durably queued before cloud acknowledgement", async ({ page }) => {
  await installApiMocks(page, { signedIn: true, cloudPapers: [paperFixture], failPaperDelete: true });
  await page.goto("/papers");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /删除/ }).click();
  await expect(page.getByText(paperFixture.title, { exact: true })).toHaveCount(0);
  const queuedType = await page.evaluate(async () => {
    const request = indexedDB.open("statlab-paper-memory", 2);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("paper-sync-operations", "readonly");
    const get = transaction.objectStore("paper-sync-operations").get("paper-cloud");
    return new Promise<string>((resolve, reject) => {
      get.onsuccess = () => resolve(get.result.type);
      get.onerror = () => reject(get.error);
    });
  });
  expect(queuedType).toBe("delete");
});
```

Use a complete `PaperRecord` literal for `paperFixture`; do not reuse a partial object from the route mock.

- [ ] **Step 2: Run the two cases and verify RED**

Run: `node node_modules/@playwright/test/cli.js test tests/e2e/papers.spec.ts --grep "PAPER-02|PAPER-03"`

Expected: both tests fail because IndexedDB version 1 has no `paper-sync-operations` store and operations are not durable.

- [ ] **Step 3: Add types and IndexedDB v2 operations**

Use the Task 2 types already present in `paper-types.ts`:

```ts
export type CloudDeletion = { id: string; deletedAt: number };
export type PaperSyncOperation =
  | { id: string; type: "upsert"; updatedAt: number; paper: PaperRecord; attempts: number; nextAttemptAt: number }
  | { id: string; type: "delete"; updatedAt: number; attempts: number; nextAttemptAt: number };
```

Upgrade `indexedDB.open(databaseName, 2)`. Keep `papers` and add `paper-sync-operations` with `{ keyPath: "id" }`. Implement one readwrite transaction spanning both stores:

```ts
export async function savePaperAndQueue(paper: PaperRecord) {
  return transact([storeName, syncStoreName], "readwrite", (transaction) => {
    const syncStore = transaction.objectStore(syncStoreName);
    const existingRequest = syncStore.get(paper.id);
    existingRequest.onsuccess = () => {
      if (existingRequest.result?.type === "delete") return;
      transaction.objectStore(storeName).put(paper);
      syncStore.put({ id: paper.id, type: "upsert", updatedAt: paper.updatedAt, paper, attempts: 0, nextAttemptAt: 0 });
    };
  });
}

export async function deletePaperAndQueue(id: string, updatedAt: number) {
  return transact([storeName, syncStoreName], "readwrite", (transaction) => {
    transaction.objectStore(storeName).delete(id);
    transaction.objectStore(syncStoreName).put({ id, type: "delete", updatedAt, attempts: 0, nextAttemptAt: 0 });
  });
}
```

Implement queue read, replace, and acknowledgement helpers using transactions that close the database on completion and reject on abort/error.

- [ ] **Step 4: Wire only local persistence and verify GREEN**

Replace the page's edit-save and delete-storage calls with the atomic helpers, leaving cloud flushing for Task 5. Update the E2E mock so a failed operation remains visible in IndexedDB after reload.

Run: `node node_modules/@playwright/test/cli.js test tests/e2e/papers.spec.ts --grep "PAPER-02|PAPER-03"`

Expected: both tests pass and directly observe one persisted upsert/delete operation after the corresponding failed cloud request.

- [ ] **Step 5: Commit after owner identity is configured**

```bash
git add app/papers/paper-storage.ts app/papers/page.tsx tests/e2e/papers.spec.ts tests/e2e/helpers.ts
git commit -m "feat: persist paper sync operations"
```

---

### Task 4: Expose Tombstones and Atomic RPC Results Through the API

**Files:**
- Modify: `app/api/cloud/papers/route.ts`
- Modify: `tests/source-invariants.test.mjs`
- Modify: `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: Task 1 RPC functions and existing `readRequestSession`/`supabaseRest`.
- Produces: `{ papers, deletions }` snapshots, PUT stale-write 409, and idempotent DELETE with server `deletedAt`.

- [ ] **Step 1: Write failing API contract invariants**

Add this test to `tests/source-invariants.test.mjs`:

```js
test("paper cloud API exposes tombstones and uses atomic authenticated RPCs", async () => {
  const route = await read("app/api/cloud/papers/route.ts");
  assert.match(route, /deleted_at/);
  assert.match(route, /deletions/);
  assert.match(route, /rpc\/sync_paper_memory/);
  assert.match(route, /rpc\/delete_paper_memory/);
  assert.match(route, /stale_write/);
  assert.match(route, /status:\s*409/);
  assert.match(route, /privateNoStore\(NextResponse\.json/);
});
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/source-invariants.test.mjs`

Expected: FAIL because the route still hard-deletes rows and directly upserts the table.

- [ ] **Step 3: Implement GET partitioning**

Select `deleted_at` with the existing columns. Return active rows through `papers` and tombstones through:

```ts
const deletions = rows
  .filter((row) => row.deleted_at)
  .map((row) => ({ id: row.id, deletedAt: new Date(row.deleted_at!).getTime() }));
```

Never include `[deleted]`, empty extracted content, or empty AI memory as an active paper.

- [ ] **Step 4: Implement PUT and DELETE RPC calls**

POST JSON to `rpc/sync_paper_memory` using `p_id`, `p_title`, `p_file_name`, `p_extracted_content`, `p_ai_memory`, and ISO `p_updated_at`. Map a returned `status: "stale"` to 409. DELETE posts `{ p_id: id }` to `rpc/delete_paper_memory` and returns the database `deletedAt`.

- [ ] **Step 5: Verify API contracts GREEN**

Run: `node --test tests/source-invariants.test.mjs`

Expected: all contract tests pass.

- [ ] **Step 6: Commit after owner identity is configured**

```bash
git add app/api/cloud/papers/route.ts tests/source-invariants.test.mjs tests/e2e/helpers.ts
git commit -m "feat: expose paper deletion tombstones"
```

---

### Task 5: Integrate Sequential Flush, Retry, and Deletion UX

**Files:**
- Modify: `app/papers/paper-sync.mjs`
- Modify: `app/papers/paper-sync.d.mts`
- Modify: `app/papers/page.tsx`
- Modify: `tests/paper-sync.test.mjs`
- Modify: `tests/e2e/papers.spec.ts`
- Modify: `tests/e2e/helpers.ts`

**Interfaces:**
- Consumes: durable queue helpers, pure retry rules, and `{ papers, deletions }` API snapshots.
- Produces: `flushPaperSyncQueue(dependencies)`, single-flight page lifecycle integration, and explicit guest/signed-in deletion messages.

- [ ] **Step 1: Add failing flush tests with injected dependencies**

Test the real orchestration function with in-memory dependency functions:

```js
test("flush is single-flight and acknowledges only successful operations", async () => {
  let releases;
  const pendingResponse = new Promise((resolve) => { releases = resolve; });
  let sends = 0;
  const dependencies = {
    online: () => true,
    now: () => 1000,
    list: async () => [{ id: "paper-1", type: "delete", updatedAt: 900, attempts: 0, nextAttemptAt: 0 }],
    send: async () => { sends += 1; await pendingResponse; return { status: 200 }; },
    acknowledge: async () => undefined,
    reschedule: async () => undefined,
    refreshCloud: async () => undefined,
  };
  const first = flushPaperSyncQueue(dependencies);
  const second = flushPaperSyncQueue(dependencies);
  await Promise.resolve();
  assert.equal(sends, 1);
  releases();
  await Promise.all([first, second]);
});
```

Add these separate literal assertions with fresh dependency objects per test:

```js
test("401 pauses the queue without acknowledging", async () => {
  const effects = [];
  await flushPaperSyncQueue(makeDependencies({ status: 401, effects }));
  assert.deepEqual(effects, ["send", "pause-auth"]);
});

test("409 refreshes cloud state without acknowledging the stale write", async () => {
  const effects = [];
  await flushPaperSyncQueue(makeDependencies({ status: 409, effects }));
  assert.deepEqual(effects, ["send", "refresh-cloud"]);
});

test("413 marks the operation non-retryable", async () => {
  const effects = [];
  await flushPaperSyncQueue(makeDependencies({ status: 413, effects }));
  assert.deepEqual(effects, ["send", "non-retryable"]);
});

test("503 persists the incremented attempt and retry time", async () => {
  const effects = [];
  await flushPaperSyncQueue(makeDependencies({ status: 503, effects, now: 10_000, attempts: 2 }));
  assert.deepEqual(effects, ["send", { type: "reschedule", attempts: 3, nextAttemptAt: 14_000 }]);
});
```

Define `makeDependencies` in the test file to return one queued delete operation and dependency methods that append exactly the effects shown above. It must not call production helpers when constructing expected arrays.

- [ ] **Step 2: Run flush tests and verify RED**

Run: `node --test tests/paper-sync.test.mjs`

Expected: FAIL because `flushPaperSyncQueue` is not exported.

- [ ] **Step 3: Implement the dependency-injected single-flight flusher**

Use a module-level `activeFlush` promise. Read eligible operations fresh, send them sequentially, acknowledge 2xx, pause on offline/401, refresh on 409, retain 413 as non-retryable, and update `attempts` plus `nextAttemptAt = now + nextRetryDelay(attempts)` for transient errors. Clear `activeFlush` in `finally`.

- [ ] **Step 4: Integrate startup reconciliation**

In `page.tsx`, load local papers and operations, fetch session and cloud snapshot, call `reconcileSnapshot`, apply tombstones locally, persist winners, then flush. Do not set `ready` while retryable operations remain.

- [ ] **Step 5: Integrate edit, online, and deletion flows**

- Debounced edits call `savePaperAndQueue`, then trigger the single-flight flush when authenticated and online.
- The `online` handler triggers a flush rather than merely changing status.
- Signed-in delete calls `deletePaperAndQueue` before removing the record from React state, then awaits/starts flushing.
- Guest delete uses local `deletePaper` without a cloud operation.
- A 409 triggers a new cloud snapshot before any further send.

Use these exact confirmation messages from the spec for signed-in and guest users.

- [ ] **Step 6: Complete Playwright behaviors and verify GREEN**

Extend PAPER-02 so network recovery produces a second PUT and empties the queue. Extend PAPER-03 so reload does not restore the deleted paper, then add PAPER-04 for a returned cloud tombstone removing a local record and PAPER-05 asserting the exact signed-in versus guest confirmation copy from the design specification.

Run: `node node_modules/@playwright/test/cli.js test tests/e2e/papers.spec.ts`

Expected: all Paper tests pass with durable retry, deletion, and copy assertions.

- [ ] **Step 7: Commit after owner identity is configured**

```bash
git add app/papers/paper-sync.mjs app/papers/paper-sync.d.mts app/papers/page.tsx tests/paper-sync.test.mjs tests/e2e/papers.spec.ts tests/e2e/helpers.ts
git commit -m "feat: synchronize paper changes reliably"
```

---

### Task 6: Full Verification and Deployment Handoff

**Files:**
- Modify: `docs/production-auth-smoke.md`
- Modify: `docs/stability-refactor-report.md`

**Interfaces:**
- Consumes: all implementation tasks and the existing Production smoke checklist.
- Produces: reproducible local evidence and an operator-ready migration/deployment checklist; it does not mutate Production.

- [ ] **Step 1: Add Paper synchronization smoke steps**

Document a two-browser-profile test that creates a paper memory, edits it offline, reconnects, verifies the second profile receives the update, deletes it, verifies the second profile receives the deletion, and confirms Network contains no browser request to `*.supabase.co`.

- [ ] **Step 2: Document migration verification queries**

Include read-only checks for `deleted_at`, both RPC functions, their execute grants, RLS enabled state, and a dedicated-test-user round trip. State that the migration must not be applied until the owner sees the SQL impact report.

- [ ] **Step 3: Run the full local gate in the required runtime**

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run test:unit
pnpm run build
pnpm run lint
pnpm run test:e2e
pnpm run test:visual
```

Expected: exit 0 for every command; unit output reports zero failures, E2E reports zero failures, and visual regression reports zero mismatches. The second lint proves generated PDF assets remain excluded.

- [ ] **Step 4: Verify repository scope**

Run:

```bash
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Expected: no whitespace errors; only Paper sync, migration, tests, docs, and the already-approved AI/ESLint reliability files are changed.

- [ ] **Step 5: Produce the Production impact report**

Report these items before any console action:

- additive `deleted_at` column and index;
- two authenticated invoker-rights RPC functions;
- no table deletion and no existing-row rewrite during migration;
- new deletes clear content and preserve minimal tombstones;
- migration-first, application-second rollout order;
- application rollback leaves additive database objects in place;
- real Production status remains `NOT VERIFIED` until authenticated smoke completes.

- [ ] **Step 6: Commit after owner identity is configured**

```bash
git add docs/production-auth-smoke.md docs/stability-refactor-report.md
git commit -m "docs: add paper sync production verification"
```

Do not push, apply the migration, or deploy as part of this task.
