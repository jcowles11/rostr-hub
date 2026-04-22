/**
 * useRetryQueue — Lightweight retry queue for failed score saves.
 *
 * Design:
 * - Failed saves are enqueued with their full payload
 * - A background interval retries items with exponential backoff
 * - Duplicate keys (player+metric+attempt+coach) replace existing entries (latest value wins)
 * - Items are dropped after maxRetries with a failure notification
 * - Queue is stored in a ref (no re-renders on internal retry ticks)
 * - State is exposed for UI (pendingCount, failedItems)
 * - navigator.onLine check pauses retries when offline
 * - When a coachId is provided, the queue is persisted to localStorage so a
 *   phone lock, tab suspend, or refresh doesn't lose queued saves. See
 *   lib/retryQueueStorage.ts.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { saveScore, type SaveScoreInput, type SaveScoreResult } from "@/services/evaluationService";
import type { MetricBounds } from "@/lib/validation";
import { loadQueue, saveQueue, type PersistedQueueState } from "@/lib/retryQueueStorage";

// ── Types ──────────────────────────────────────────────────────────

export interface QueuedScore {
  key: string;
  input: SaveScoreInput;
  existingEvalId?: string;
  metricBounds?: MetricBounds;
  retries: number;
  maxRetries: number;
  lastError: string;
  nextRetryAt: number; // timestamp ms
  /** Display-only fields */
  playerName: string;
  metricName: string;
  value: number;
}

export interface RetryQueueStatus {
  pendingCount: number;
  failedItems: QueuedScore[];
  isRetrying: boolean;
}

export interface RetryQueueCallbacks {
  /** Called when a queued score succeeds on retry. */
  onRetrySuccess?: (item: QueuedScore) => void;
  /** Called when a queued score exhausts all retries. */
  onRetryExhausted?: (item: QueuedScore) => void;
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_RETRIES = 4;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s, 16s
const TICK_INTERVAL_MS = 1000; // Check queue every second
const PERSIST_DEBOUNCE_MS = 50;

// ── Helpers ────────────────────────────────────────────────────────

function scoreKey(input: SaveScoreInput): string {
  return `${input.player_id}|${input.metric_id}|${input.attempt_number}|${input.coach_id}`;
}

function nextDelay(retries: number): number {
  return BASE_DELAY_MS * Math.pow(2, retries);
}

// ── Hook ───────────────────────────────────────────────────────────

export interface UseRetryQueueOptions {
  /**
   * When provided, the queue is persisted to localStorage under this coach's
   * namespace and hydrated on mount. Omit to run purely in-memory (e.g. demo
   * mode or before auth resolves).
   */
  coachId?: string | null;
}

export function useRetryQueue(callbacks?: RetryQueueCallbacks, options?: UseRetryQueueOptions) {
  const queueRef = useRef<Map<string, QueuedScore>>(new Map());
  const failedRef = useRef<QueuedScore[]>([]);
  const retryingRef = useRef(false);
  const coachIdRef = useRef<string | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedForRef = useRef<string | null>(null);
  // Snapshot of the last status we surfaced — used to skip no-op state updates
  // and skip persistence writes when queue state hasn't actually changed.
  const lastStatusSigRef = useRef<string>("0|0||false");

  // UI-facing state — updated after each tick that changes the queue
  const [status, setStatus] = useState<RetryQueueStatus>({
    pendingCount: 0,
    failedItems: [],
    isRetrying: false,
  });

  // ── Persistence ────────────────────────────────────────────────
  // Debounced write: bursts of enqueue/retry don't thrash localStorage.
  const schedulePersist = useCallback(() => {
    const coachId = coachIdRef.current;
    if (!coachId) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      saveQueue(coachId, {
        pending: [...queueRef.current.values()],
        failed: [...failedRef.current],
      });
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  // Only push a new status object to React (and a new persistence write)
  // when something the UI cares about actually changed: pending count,
  // isRetrying flag, or the failed-items signature (key + lastError).
  // This keeps the 1-second retry tick from re-rendering ScoreEntry on
  // every pass when the queue is sitting idle between backoffs.
  const syncStatus = useCallback(() => {
    const nextPending = queueRef.current.size;
    const nextFailed = failedRef.current;
    const nextRetrying = retryingRef.current;
    const failedSig = nextFailed.map((f) => `${f.key}:${f.lastError}`).join("|");
    const sig = `${nextPending}|${nextFailed.length}|${failedSig}|${nextRetrying}`;

    if (sig === lastStatusSigRef.current) return;
    lastStatusSigRef.current = sig;

    setStatus({
      pendingCount: nextPending,
      failedItems: [...nextFailed],
      isRetrying: nextRetrying,
    });
    schedulePersist();
  }, [schedulePersist]);

  /** Enqueue a failed score for retry. Replaces any existing entry for the same key (latest value wins). */
  const enqueue = useCallback(
    (
      input: SaveScoreInput,
      opts: {
        existingEvalId?: string;
        metricBounds?: MetricBounds;
        lastError: string;
        playerName: string;
        metricName: string;
      }
    ) => {
      const key = scoreKey(input);
      const existing = queueRef.current.get(key);

      const item: QueuedScore = {
        key,
        input,
        existingEvalId: opts.existingEvalId,
        metricBounds: opts.metricBounds,
        retries: existing ? existing.retries : 0,
        maxRetries: MAX_RETRIES,
        lastError: opts.lastError,
        nextRetryAt: Date.now() + nextDelay(existing ? existing.retries : 0),
        playerName: opts.playerName,
        metricName: opts.metricName,
        value: input.value,
      };

      queueRef.current.set(key, item);
      syncStatus();
    },
    [syncStatus]
  );

  /** Remove a specific item from the failed list (coach dismisses it). */
  const dismissFailed = useCallback(
    (key: string) => {
      failedRef.current = failedRef.current.filter((i) => i.key !== key);
      syncStatus();
    },
    [syncStatus]
  );

  /** Manually retry all failed items (moves them back to the queue). */
  const retryAllFailed = useCallback(() => {
    for (const item of failedRef.current) {
      item.retries = 0;
      item.nextRetryAt = Date.now() + BASE_DELAY_MS;
      queueRef.current.set(item.key, item);
    }
    failedRef.current = [];
    syncStatus();
  }, [syncStatus]);

  // ── Hydration from localStorage ────────────────────────────────
  // Runs when coachId becomes available (or changes). Merges persisted items
  // into the in-memory queue without creating duplicates.
  useEffect(() => {
    const coachId = options?.coachId ?? null;
    coachIdRef.current = coachId;
    if (!coachId) return;
    if (hydratedForRef.current === coachId) return;
    hydratedForRef.current = coachId;

    const persisted: PersistedQueueState = loadQueue(coachId);
    if (persisted.pending.length === 0 && persisted.failed.length === 0) return;

    const now = Date.now();
    let staggered = 0;
    for (const item of persisted.pending) {
      // Don't clobber items that were enqueued in this session
      if (queueRef.current.has(item.key)) continue;
      // Let items be eligible immediately (with a small stagger so they
      // don't all fire in the same tick and overwhelm a flaky connection)
      queueRef.current.set(item.key, { ...item, nextRetryAt: now + staggered });
      staggered += 250;
    }
    const existingFailedKeys = new Set(failedRef.current.map((f) => f.key));
    for (const item of persisted.failed) {
      if (existingFailedKeys.has(item.key)) continue;
      failedRef.current.push(item);
    }
    syncStatus();
  }, [options?.coachId, syncStatus]);

  // ── Background retry tick ──────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(async () => {
      const queue = queueRef.current;
      if (queue.size === 0) return;

      // Don't retry if browser says we're offline
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      // Don't overlap retry batches
      if (retryingRef.current) return;

      const now = Date.now();
      const readyItems = [...queue.values()].filter((item) => item.nextRetryAt <= now);
      // Idle tick: items present but still in backoff — don't touch state.
      if (readyItems.length === 0) return;

      retryingRef.current = true;

      for (const item of readyItems) {
        const result: SaveScoreResult = await saveScore(
          item.input,
          item.existingEvalId,
          item.metricBounds
        );

        if (!result.error) {
          // Success — remove from queue
          queue.delete(item.key);
          callbacks?.onRetrySuccess?.(item);
        } else {
          // Still failing
          item.retries += 1;
          item.lastError = result.error;

          if (item.retries >= item.maxRetries) {
            // Exhausted — move to failed list
            queue.delete(item.key);
            failedRef.current.push(item);
            callbacks?.onRetryExhausted?.(item);
          } else {
            // Schedule next retry with exponential backoff
            item.nextRetryAt = Date.now() + nextDelay(item.retries);
          }
        }
      }

      retryingRef.current = false;
      syncStatus();
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [callbacks, syncStatus]);

  // Flush any pending debounced write on unmount so the final state is saved.
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
        const coachId = coachIdRef.current;
        if (coachId) {
          saveQueue(coachId, {
            pending: [...queueRef.current.values()],
            failed: [...failedRef.current],
          });
        }
      }
    };
  }, []);

  return {
    enqueue,
    dismissFailed,
    retryAllFailed,
    status,
  };
}
