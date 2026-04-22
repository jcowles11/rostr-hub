/**
 * retryQueueStorage — localStorage persistence for the Score Entry retry queue.
 *
 * Why: the retry queue lives in memory. If the coach's phone locks, the browser
 * backgrounds and purges the tab, or they refresh during patchy field service,
 * queued scores would be silently lost. Persisting to localStorage closes that
 * data-loss path so a coach can resume a scoring session and still have their
 * pending saves recovered.
 *
 * Design:
 * - Keyed by coach ID so multi-user devices don't collide
 * - Schema version baked into the key — a version bump naturally invalidates
 *   old payloads without needing migration logic
 * - Every localStorage access is wrapped in try/catch: private-browsing Safari
 *   and storage-full situations must not crash the scoring flow
 * - Corrupted JSON is cleared and treated as empty
 */
import type { QueuedScore } from "@/hooks/useRetryQueue";

const SCHEMA_VERSION = 1;
const KEY_PREFIX = `rostr:retry-queue:v${SCHEMA_VERSION}:`;

export interface PersistedQueueState {
  pending: QueuedScore[];
  failed: QueuedScore[];
}

const EMPTY_STATE: PersistedQueueState = { pending: [], failed: [] };

function storageKey(coachId: string): string {
  return `${KEY_PREFIX}${coachId}`;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    // Touch it to trigger the SecurityError in locked-down private modes
    const probe = "__rostr_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Load the persisted queue for a coach. Returns empty state on any failure. */
export function loadQueue(coachId: string): PersistedQueueState {
  if (!coachId) return { ...EMPTY_STATE };
  const storage = getStorage();
  if (!storage) return { ...EMPTY_STATE };

  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey(coachId));
  } catch {
    return { ...EMPTY_STATE };
  }
  if (!raw) return { ...EMPTY_STATE };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    const pending = Array.isArray(parsed.pending) ? (parsed.pending as QueuedScore[]) : [];
    const failed = Array.isArray(parsed.failed) ? (parsed.failed as QueuedScore[]) : [];
    return { pending, failed };
  } catch {
    // Corrupt payload — wipe it and start fresh so we don't re-hit the error
    try {
      storage.removeItem(storageKey(coachId));
    } catch {
      /* ignore */
    }
    return { ...EMPTY_STATE };
  }
}

/** Persist the queue for a coach. Silent on any failure — scoring must not break. */
export function saveQueue(coachId: string, state: PersistedQueueState): void {
  if (!coachId) return;
  const storage = getStorage();
  if (!storage) return;

  // If both lists are empty, remove the key instead of writing "{}" noise
  if (state.pending.length === 0 && state.failed.length === 0) {
    try {
      storage.removeItem(storageKey(coachId));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    storage.setItem(storageKey(coachId), JSON.stringify(state));
  } catch {
    /* quota exceeded, serialization error, etc. — ignore */
  }
}

/** Remove the persisted queue for a coach (e.g. on sign-out). */
export function clearQueue(coachId: string): void {
  if (!coachId) return;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(coachId));
  } catch {
    /* ignore */
  }
}
