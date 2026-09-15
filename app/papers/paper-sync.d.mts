import type { CloudDeletion, PaperRecord, PaperSyncOperation } from "./paper-types";

export type RetryDecision = "pause-offline" | "pause-auth" | "refresh-cloud" | "non-retryable" | "retry" | "complete";

export function collapseOperation(
  existing: PaperSyncOperation | undefined,
  incoming: PaperSyncOperation,
): PaperSyncOperation;

export function reconcileSnapshot(input: {
  localPapers: PaperRecord[];
  cloudPapers: PaperRecord[];
  deletions: CloudDeletion[];
  pending: PaperSyncOperation[];
}): { papers: PaperRecord[]; pending: PaperSyncOperation[] };

export function retryDecision(status: number, attempts: number, online: boolean): RetryDecision;
export function nextRetryDelay(attempts: number): number;

export type FlushDependencies = {
  online: () => boolean;
  now: () => number;
  list: () => Promise<PaperSyncOperation[]>;
  send: (operation: PaperSyncOperation) => Promise<{ status: number }>;
  acknowledge: (id: string, operation: PaperSyncOperation) => Promise<void>;
  reschedule: (next: PaperSyncOperation, sent: PaperSyncOperation) => Promise<void>;
  refreshCloud: (conflicted: PaperSyncOperation) => Promise<void>;
  onState: (state: RetryDecision) => void;
};

export function flushPaperSyncQueue(dependencies: FlushDependencies): Promise<void>;
