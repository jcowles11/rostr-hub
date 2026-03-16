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
 *
 * Future: This queue could be persisted to localStorage/IndexedDB
 * for true offline scoring support.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { saveScore, type SaveScoreInput, type SaveScoreResult } from "@/services/evaluationService";
import type { MetricBounds } from "@/lib/validation";

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

// ── Helpers ────────────────────────────────────────────────────────

function scoreKey(input: SaveScoreInput): string {
  return `${input.player_id}|${input.metric_id}|${input.attempt_number}|${input.coach_id}`;
}

function nextDelay(retries: number): number {
  return BASE_DELAY_MS * Math.pow(2, retries);
}

// ── Hook ───────────────────────────────────────────────────────────

export function useRetryQueue(callbacks?: RetryQueueCallbacks) {
  const queueRef = useRef<Map<string, QueuedScore>>(new Map());
  const failedRef = useRef<QueuedScore[]>([]);
  const retryingRef = useRef(false);

  // UI-facing state — updated after each tick that changes the queue
  const [status, setStatus] = useState<RetryQueueStatus>({
    pendingCount: 0,
    failedItems: [],
    isRetrying: false,
  });

  const syncStatus = useCallback(() => {
    setStatus({
      pendingCount: queueRef.current.size,
      failedItems: [...failedRef.current],
      isRetrying: retryingRef.current,
    });
  }, []);

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

  // ── Background retry tick ──────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(async () => {
      const queue = queueRef.current;
      if (queue.size === 0) return;

      // Don't retry if browser says we're offline
      if (typeof navigator !== "undefined" && !navigator.onLine) return;

      // Don't overlap retry batches
      if (retryingRef.current) return;
      retryingRef.current = true;

      const now = Date.now();
      const readyItems = [...queue.values()].filter((item) => item.nextRetryAt <= now);

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

  return {
    enqueue,
    dismissFailed,
    retryAllFailed,
    status,
  };
}
