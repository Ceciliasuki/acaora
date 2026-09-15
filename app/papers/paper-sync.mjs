export function collapseOperation(existing, incoming) {
  if (!existing) return incoming;
  if (existing.type === "delete") return existing;
  if (incoming.type === "delete") return incoming;
  return incoming.updatedAt > existing.updatedAt ? incoming : existing;
}

export function reconcileSnapshot({ localPapers, cloudPapers, deletions, pending }) {
  const tombstoneIds = new Set(deletions.map((item) => item.id));
  const pendingDeletes = pending.filter((operation) => operation.type === "delete" && !tombstoneIds.has(operation.id));
  const hiddenIds = new Set([...tombstoneIds, ...pendingDeletes.map((operation) => operation.id)]);
  const cloudById = new Map(cloudPapers.filter((paper) => !hiddenIds.has(paper.id)).map((paper) => [paper.id, paper]));
  const paperById = new Map(cloudById);
  const operationById = new Map(pendingDeletes.map((operation) => [operation.id, operation]));
  const pendingById = new Map(pending.filter((operation) => !tombstoneIds.has(operation.id)).map((operation) => [operation.id, operation]));

  for (const paper of localPapers) {
    if (hiddenIds.has(paper.id)) continue;
    const cloudPaper = cloudById.get(paper.id);
    if (!cloudPaper || paper.updatedAt > cloudPaper.updatedAt) {
      paperById.set(paper.id, paper);
      operationById.set(paper.id, collapseOperation(pendingById.get(paper.id), {
        id: paper.id,
        ...(paper.ownerId ? { ownerId: paper.ownerId } : {}),
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

export function retryDecision(status, attempts, online) {
  void attempts;
  if (!online) return "pause-offline";
  if (status === 401) return "pause-auth";
  if (status === 409) return "refresh-cloud";
  if (status === 413) return "non-retryable";
  if (status >= 500 || status === 408 || status === 429) return "retry";
  return status >= 200 && status < 300 ? "complete" : "non-retryable";
}

export function nextRetryDelay(attempts) {
  return Math.min(60_000, 1_000 * (2 ** attempts));
}

let activeFlush = null;

export function flushPaperSyncQueue(dependencies) {
  if (activeFlush) return activeFlush;
  activeFlush = runFlush(dependencies).finally(() => { activeFlush = null; });
  return activeFlush;
}

async function runFlush({ online, now, list, send, acknowledge, reschedule, refreshCloud, onState }) {
  if (!online()) {
    onState("pause-offline");
    return;
  }
  for (const operation of await list()) {
    if (operation.blockedReason) continue;
    if (!online()) {
      onState("pause-offline");
      return;
    }
    if (operation.nextAttemptAt > now()) continue;
    const response = await send(operation);
    const decision = retryDecision(response.status, operation.attempts, online());
    if (decision === "complete") {
      await acknowledge(operation.id, operation);
      continue;
    }
    if (decision === "refresh-cloud") await refreshCloud(operation);
    else if (decision === "retry") {
      await reschedule({
        ...operation,
        attempts: operation.attempts + 1,
        nextAttemptAt: now() + nextRetryDelay(operation.attempts),
      }, operation);
    } else if (decision === "non-retryable" && response.status === 413) {
      await reschedule({ ...operation, blockedReason: "too-large" }, operation);
      onState(decision);
    } else onState(decision);
    return;
  }
}
