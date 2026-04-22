import { describe, it, expect, beforeEach, vi } from "vitest";
import { loadQueue, saveQueue, clearQueue, type PersistedQueueState } from "../retryQueueStorage";
import type { QueuedScore } from "@/hooks/useRetryQueue";

const COACH_A = "coach-aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const COACH_B = "coach-bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

function makeItem(overrides: Partial<QueuedScore> = {}): QueuedScore {
  return {
    key: overrides.key ?? "player1|metric1|1|coach1",
    input: {
      program_id: "p1",
      player_id: "player1",
      metric_id: "metric1",
      coach_id: "coach1",
      value: 42,
      attempt_number: 1,
      session_id: "s1",
    },
    retries: 1,
    maxRetries: 4,
    lastError: "Network error",
    nextRetryAt: Date.now() + 2000,
    playerName: "Smith",
    metricName: "40-yard dash",
    value: 42,
    ...overrides,
  };
}

function emptyState(): PersistedQueueState {
  return { pending: [], failed: [] };
}

beforeEach(() => {
  localStorage.clear();
});

describe("saveQueue → loadQueue round trip", () => {
  it("persists pending and failed items for a coach", () => {
    const pending = [makeItem({ key: "k1" }), makeItem({ key: "k2", retries: 2 })];
    const failed = [makeItem({ key: "k3", retries: 4, lastError: "Exhausted" })];

    saveQueue(COACH_A, { pending, failed });
    const loaded = loadQueue(COACH_A);

    expect(loaded.pending).toHaveLength(2);
    expect(loaded.pending.map((i) => i.key)).toEqual(["k1", "k2"]);
    expect(loaded.pending[1].retries).toBe(2);
    expect(loaded.failed).toHaveLength(1);
    expect(loaded.failed[0].key).toBe("k3");
    expect(loaded.failed[0].lastError).toBe("Exhausted");
  });

  it("preserves all QueuedScore fields through serialization", () => {
    const item = makeItem({
      key: "full-round-trip",
      existingEvalId: "eval-123",
      metricBounds: { min_value: 0, max_value: 100, metric_type: "measured", name: "Speed", unit: "mph" },
      value: 88.5,
    });
    saveQueue(COACH_A, { pending: [item], failed: [] });
    const loaded = loadQueue(COACH_A);
    expect(loaded.pending[0]).toEqual(item);
  });
});

describe("loadQueue", () => {
  it("returns empty state when nothing is persisted", () => {
    expect(loadQueue(COACH_A)).toEqual(emptyState());
  });

  it("returns empty state for empty coachId", () => {
    saveQueue(COACH_A, { pending: [makeItem()], failed: [] });
    expect(loadQueue("")).toEqual(emptyState());
  });
});

describe("corrupted storage recovery", () => {
  it("returns empty state and wipes the key when JSON is malformed", () => {
    localStorage.setItem(`rostr:retry-queue:v1:${COACH_A}`, "{not valid json");
    const loaded = loadQueue(COACH_A);
    expect(loaded).toEqual(emptyState());
    // Corrupt key should have been removed so we don't re-hit the parse failure
    expect(localStorage.getItem(`rostr:retry-queue:v1:${COACH_A}`)).toBeNull();
  });

  it("returns empty state when payload is a valid JSON scalar, not an object", () => {
    localStorage.setItem(`rostr:retry-queue:v1:${COACH_A}`, "42");
    const loaded = loadQueue(COACH_A);
    expect(loaded).toEqual(emptyState());
  });

  it("coerces non-array pending/failed fields to empty arrays", () => {
    localStorage.setItem(
      `rostr:retry-queue:v1:${COACH_A}`,
      JSON.stringify({ pending: "oops", failed: { weird: true } })
    );
    const loaded = loadQueue(COACH_A);
    expect(loaded.pending).toEqual([]);
    expect(loaded.failed).toEqual([]);
  });
});

describe("namespace separation", () => {
  it("keeps different coaches' queues isolated", () => {
    saveQueue(COACH_A, { pending: [makeItem({ key: "a-only" })], failed: [] });
    saveQueue(COACH_B, { pending: [makeItem({ key: "b-only" })], failed: [] });

    expect(loadQueue(COACH_A).pending.map((i) => i.key)).toEqual(["a-only"]);
    expect(loadQueue(COACH_B).pending.map((i) => i.key)).toEqual(["b-only"]);
  });

  it("clearQueue only affects the targeted coach", () => {
    saveQueue(COACH_A, { pending: [makeItem({ key: "a" })], failed: [] });
    saveQueue(COACH_B, { pending: [makeItem({ key: "b" })], failed: [] });

    clearQueue(COACH_A);

    expect(loadQueue(COACH_A)).toEqual(emptyState());
    expect(loadQueue(COACH_B).pending).toHaveLength(1);
  });
});

describe("saveQueue housekeeping", () => {
  it("removes the storage key when state is empty (no noise left behind)", () => {
    saveQueue(COACH_A, { pending: [makeItem()], failed: [] });
    expect(localStorage.getItem(`rostr:retry-queue:v1:${COACH_A}`)).not.toBeNull();

    saveQueue(COACH_A, { pending: [], failed: [] });
    expect(localStorage.getItem(`rostr:retry-queue:v1:${COACH_A}`)).toBeNull();
  });

  it("no-ops for empty coachId (doesn't touch storage)", () => {
    saveQueue("", { pending: [makeItem()], failed: [] });
    expect(localStorage.length).toBe(0);
  });
});

describe("failure safety", () => {
  it("loadQueue returns empty state when localStorage.getItem throws", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error("SecurityError");
    });
    try {
      expect(loadQueue(COACH_A)).toEqual(emptyState());
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it("saveQueue swallows quota-exceeded errors without throwing", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn((key: string) => {
      // Allow the probe write in getStorage() to succeed, fail on the real write
      if (key.startsWith("rostr:retry-queue:")) {
        throw new Error("QuotaExceededError");
      }
    });
    try {
      expect(() => saveQueue(COACH_A, { pending: [makeItem()], failed: [] })).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  it("clearQueue is a silent no-op when removeItem throws", () => {
    const original = Storage.prototype.removeItem;
    Storage.prototype.removeItem = vi.fn(() => {
      throw new Error("cannot remove");
    });
    try {
      expect(() => clearQueue(COACH_A)).not.toThrow();
    } finally {
      Storage.prototype.removeItem = original;
    }
  });
});
