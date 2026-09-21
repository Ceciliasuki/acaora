import assert from "node:assert/strict";
import test from "node:test";
import {
  collapseOperation,
  flushPaperSyncQueue,
  nextRetryDelay,
  reconcileSnapshot,
  retryDecision,
} from "../app/papers/paper-sync.mjs";

const local = { id: "paper-1", title: "local", updatedAt: 200 };
const cloud = { id: "paper-1", title: "cloud", updatedAt: 100 };

test("a delete supersedes a queued upsert", () => {
  assert.deepEqual(
    collapseOperation(
      { id: "paper-1", type: "upsert", updatedAt: 200, paper: local, attempts: 0, nextAttemptAt: 0 },
      { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 },
    ),
    { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 },
  );
});

test("an existing queued delete cannot be replaced by a later automatic save", () => {
  const deletion = { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 };
  assert.deepEqual(
    collapseOperation(deletion, { id: "paper-1", type: "upsert", updatedAt: 400, paper: local, attempts: 0, nextAttemptAt: 0 }),
    deletion,
  );
});

test("a cloud tombstone removes local content and queued upserts", () => {
  assert.deepEqual(reconcileSnapshot({
    localPapers: [local],
    cloudPapers: [],
    deletions: [{ id: "paper-1", deletedAt: 300 }],
    pending: [{ id: "paper-1", type: "upsert", updatedAt: 200, paper: local, attempts: 0, nextAttemptAt: 0 }],
  }), { papers: [], pending: [] });
});

test("a queued delete hides an active cloud record", () => {
  const deletion = { id: "paper-1", type: "delete", updatedAt: 300, attempts: 0, nextAttemptAt: 0 };
  assert.deepEqual(reconcileSnapshot({
    localPapers: [],
    cloudPapers: [cloud],
    deletions: [],
    pending: [deletion],
  }), { papers: [], pending: [deletion] });
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
  assert.equal(retryDecision(204, 0, true), "complete");
});

test("retry delay caps at sixty seconds", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(nextRetryDelay), [1000, 2000, 4000, 8000, 16000, 32000, 60000]);
});

test("flush is single-flight and acknowledges only successful operations", async () => {
  let releaseResponse;
  const pendingResponse = new Promise((resolve) => { releaseResponse = resolve; });
  let sends = 0;
  const acknowledged = [];
  const dependencies = makeDependencies({
    status: 200,
    send: async () => { sends += 1; await pendingResponse; return { status: 200 }; },
    acknowledge: async (id) => { acknowledged.push(id); },
  });
  const first = flushPaperSyncQueue(dependencies);
  const second = flushPaperSyncQueue(dependencies);
  assert.equal(first, second);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(sends, 1);
  releaseResponse();
  await Promise.all([first, second]);
  assert.deepEqual(acknowledged, ["paper-1"]);
});

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
  assert.deepEqual(effects, ["send", { type: "blocked", reason: "too-large" }, "non-retryable"]);
});

test("503 persists the incremented attempt and retry time", async () => {
  const effects = [];
  await flushPaperSyncQueue(makeDependencies({ status: 503, effects, now: 10_000, attempts: 2 }));
  assert.deepEqual(effects, ["send", { type: "reschedule", attempts: 3, nextAttemptAt: 14_000 }]);
});

function makeDependencies({ status, effects = [], now = 1_000, attempts = 0, send, acknowledge }) {
  const operation = { id: "paper-1", type: "delete", updatedAt: 900, attempts, nextAttemptAt: 0 };
  return {
    online: () => true,
    now: () => now,
    list: async () => [operation],
    send: send ?? (async () => { effects.push("send"); return { status }; }),
    acknowledge: acknowledge ?? (async () => { effects.push("acknowledge"); }),
    reschedule: async (next) => {
      effects.push(next.blockedReason
        ? { type: "blocked", reason: next.blockedReason }
        : { type: "reschedule", attempts: next.attempts, nextAttemptAt: next.nextAttemptAt });
    },
    refreshCloud: async () => { effects.push("refresh-cloud"); },
    onState: (state) => { effects.push(state); },
  };
}
