# Paper Cloud Sync Reliability Design

**Date:** 2026-09-09

**Status:** Approved in chat

## Objective

Make PaperLab memory synchronization reliable across offline periods and multiple devices. A signed-in user's delete action must remove the paper memory from the current device and cloud, then propagate to every other device without stale local content resurrecting it.

“Paper memory” means extracted text, translations, notes, bookmarks, reading position, and saved AI results. The original PDF remains device-local and is never uploaded or affected by cloud deletion.

## Scope

This change covers PaperLab records only:

- persistent local sync operations;
- automatic retry after startup, sign-in, and network recovery;
- cloud deletion tombstones;
- deterministic reconciliation of local records, pending operations, and the cloud snapshot;
- stale-write protection;
- explicit deletion copy and sync status;
- automated tests for offline, retry, conflict, and deletion behavior.

It does not add background push notifications, synchronize original PDFs, change Project synchronization, purchase infrastructure, or introduce a general-purpose event log.

## Chosen Approach

Use an additive database tombstone plus a compact IndexedDB operation queue.

A simple retry-only design is rejected because a second device can retain and later re-upload a record that another device deleted. A full append-only event log is rejected because it adds retention, compaction, ordering, and operational complexity beyond the current product's needs.

## Cloud Data Model

Add `deleted_at timestamptz` to `public.paper_memories`. Active rows have `deleted_at = null`. Tombstone rows keep only `user_id`, `id`, `updated_at`, and `deleted_at`; `title` becomes `[deleted]`, `file_name` becomes an empty string, and `extracted_content` and `ai_memory` become empty JSON objects. This removes user content while retaining the minimum marker required to prevent resurrection.

Add an index on `(user_id, updated_at desc)`. Existing RLS policies remain authoritative and continue restricting every record to `auth.uid() = user_id`.

Two authenticated database functions provide atomic conflict behavior:

1. `sync_paper_memory(...)` inserts or updates an active record only when no tombstone exists for the same `(user_id, id)` and the incoming `updated_at` is newer than or equal to the stored version. It returns `synced` or `stale`.
2. `delete_paper_memory(id)` inserts a tombstone even when the active record never reached the server. For an existing row it clears all user content and sets `updated_at`/`deleted_at` from the database clock. A valid authenticated delete always wins over an active row; client clock skew cannot prevent a user's deletion. Repeating it advances no content and remains successful.

Both functions derive the user from `auth.uid()` rather than accepting a caller-supplied user ID. Execute permission is revoked from `public` and `anon` and granted only to `authenticated`. They run with invoker rights so existing RLS remains in force.

Tombstones are retained indefinitely in this version. They contain no paper content and are required to stop long-offline devices from recreating deleted records. Retention/compaction is a separate future design.

## API Contract

`GET /api/cloud/papers` remains authenticated and returns:

```json
{
  "papers": [],
  "deletions": [{ "id": "paper-id", "deletedAt": 1788912000000 }]
}
```

Active rows are normalized into `papers`; tombstones are normalized into `deletions`. Neither response exposes another user's records.

`PUT /api/cloud/papers` keeps the existing payload limit and calls `sync_paper_memory`. It returns `{ "synced": true }` for an accepted write and HTTP 409 with `{ "error": "云端已有更新版本。", "code": "stale_write" }` for a stale or tombstoned record.

`DELETE /api/cloud/papers?id=...` calls `delete_paper_memory` and returns `{ "deleted": true, "deletedAt": 1788912000000 }` using the database timestamp returned by the function. Repeating the same deletion is idempotent. Missing authentication, malformed IDs, upstream timeouts, and database failures retain the existing private/no-store response policy.

## Local Data Model

Account-isolation clarification (2026-09-15): local Paper records and queued operations carry the signed-in user ID, and snapshot/flush operate only on that user's entries. Legacy unowned records remain device-only guest records rather than being automatically claimed by whichever account signs in next. This prevents cross-account upload on a shared browser; any future legacy import requires an explicit user-owned migration flow.

Upgrade the existing IndexedDB database from version 1 to version 2 and add a `paper-sync-operations` object store keyed by paper ID. There is at most one pending operation per paper:

```ts
type PaperSyncOperation =
  | { id: string; type: "upsert"; updatedAt: number; paper: PaperRecord; attempts: number; nextAttemptAt: number }
  | { id: string; type: "delete"; updatedAt: number; attempts: number; nextAttemptAt: number };
```

Writing a new upsert replaces an older upsert for the same paper. A delete always replaces a pending upsert. Once a delete exists, later automatic saves for the same ID are ignored. Re-importing a PDF creates a new paper ID and is therefore an explicit new record.

IndexedDB transactions must resolve only after both the paper change and matching queue update have committed. Local UI state must not claim cloud synchronization merely because the device write succeeded.

## Reconciliation and Sync Flow

On PaperLab startup:

1. Read local papers and pending operations.
2. Read the same-origin session endpoint.
3. For guests, show local papers and do not flush cloud operations.
4. For signed-in users, fetch the cloud snapshot.
5. Apply cloud tombstones first: delete matching local papers and discard matching pending upserts. A tombstone always wins for its ID, regardless of client clock skew.
6. Merge remaining active local and cloud records by ID. The newer `updatedAt` wins.
7. Persist cloud winners locally. Queue local winners that are absent from or newer than cloud.
8. Collapse operations by paper ID and flush them sequentially.

On every local paper edit, save the paper and its upsert operation together after the existing debounce. On delete, remove the local paper and persist a delete operation before updating the UI. The delete request is no longer fire-and-forget.

On the browser `online` event, session restoration, or a successful cloud request, flush eligible operations again. Failed operations remain durable. Retry delays are 1, 2, 4, 8, 16, 32, then 60 seconds maximum; closing the page does not lose the queue. HTTP 401 pauses flushing until session restoration. HTTP 409 discards the stale local upsert and triggers a fresh cloud snapshot. HTTP 413 keeps the paper locally and marks that operation as non-retryable until the paper content changes.

Only one flush runs at a time. The next flush reads the queue again rather than relying on a stale React closure.

## User Experience

For signed-in users, deletion confirmation reads:

> 从所有设备删除“{title}”的论文记忆？原始 PDF 不受影响；提取文本、翻译、笔记、阅读进度和 AI 结果将被删除。

For guests it reads:

> 从当前设备删除“{title}”的论文记忆？原始 PDF 不受影响。

The record disappears locally after its durable delete operation is committed. While offline, the UI states that deletion is waiting to synchronize. A failed cloud request does not restore the record in the current session; it remains queued and visible through the existing cloud status treatment.

The current status vocabulary remains `checking`, `guest`, `syncing`, `offline`, `ready`, and `error`. `ready` means there are no retryable pending operations. `syncing` means a flush is active or eligible work remains.

## Security and Privacy

- Original PDF bytes remain local and never enter the queue or API payload.
- Tombstones clear all extracted content and AI results on the server.
- API routes continue using the HttpOnly same-origin Supabase session.
- Database functions derive identity from `auth.uid()` and cannot operate on another user's rows.
- No service-role, secret key, or Supabase server credential is added to browser code.
- Payload limits and private/no-store response headers remain enforced.

## Files and Responsibilities

- `supabase/migrations/0005_paper_sync_tombstones.sql`: additive column, index, atomic functions, grants, and revocations.
- `app/api/cloud/papers/route.ts`: API validation, snapshot normalization, RPC calls, and stale-write responses.
- `app/papers/paper-types.ts`: sync operation and deletion marker types.
- `app/papers/paper-storage.ts`: IndexedDB v2 migration and atomic paper/queue operations.
- `app/papers/paper-sync.ts`: pure reconciliation, queue collapse, retry classification, and flush orchestration.
- `app/papers/page.tsx`: lifecycle integration, status display, and explicit deletion copy.
- `tests/`: unit tests for pure synchronization rules, route/source invariants, and Playwright flows.

## Testing

Tests must be written before each behavior change and observed failing for the intended reason.

Required cases:

- local newer than cloud queues an upsert;
- cloud newer than local replaces the local record;
- cloud tombstone removes local data and pending upserts;
- offline delete persists and flushes after network recovery;
- delete supersedes a queued upsert;
- repeated deletion is idempotent;
- stale upsert cannot overwrite a newer cloud record or tombstone;
- HTTP 401 pauses, 409 reconciles, 413 becomes non-retryable, and transient failures back off;
- only one queue flush runs concurrently;
- guest deletion remains device-only;
- signed-in deletion copy says all devices and original PDF unaffected;
- original PDF bytes never appear in storage or API payloads.

The complete gate is typecheck, lint, unit tests, production build, Playwright/axe, and visual regression. A real Production authenticated smoke remains mandatory after deployment and cannot be replaced by mocks.

## Rollout and Rollback

Rollout order:

1. Review the migration SQL and record the current Production schema state.
2. Apply the additive migration to the existing Supabase project.
3. Verify functions, RLS, grants, an active-record round trip, and a tombstone round trip using a dedicated test user.
4. Deploy the application from GitHub `main`.
5. Verify `/api/version`, then run the authenticated Production smoke on two browser profiles/devices.

The database migration must precede the application deployment because the new API depends on the functions. The old application remains compatible with the additive column during the rollout window.

If the application must be rolled back, redeploy the prior application commit and leave the additive column/functions in place; they are inert for the old code. Do not drop the column or functions during incident response. A destructive schema rollback requires a separate reviewed change after data export and verification.

## Acceptance Criteria

- A signed-in deletion removes local content immediately after durable queueing, clears cloud content, and removes the record from another device after its next sync.
- A device that was offline before deletion cannot resurrect the deleted record when it reconnects.
- Local edits and deletions survive page reloads and network interruptions.
- Older writes do not overwrite newer cloud state.
- Guests retain device-only behavior.
- No original PDF is uploaded.
- All automated gates pass, and Production results are explicitly recorded as `VERIFIED`, `FAIL`, or `NOT VERIFIED`.
