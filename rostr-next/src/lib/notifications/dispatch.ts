import type { NotificationEvent } from "./types";

/**
 * Notification dispatch — currently a no-op shim that logs.
 *
 * The shape lets callsites emit events today (with confidence the
 * scaffolding will route them correctly later) without requiring
 * the email/push integration to be live.
 *
 * Pre-revenue stage: every emit is recorded to the console + (when
 * the table is wired) to a future `notification_log` table for audit.
 * No actual email is sent. No actual push is delivered. The in_app
 * channel is also deferred — the existing message inbox surfaces
 * coach-to-coach communication only, not system events.
 *
 * Migration path (when the time comes):
 *
 *   1. Resend wired for email channel — `sendEmail()` impl in
 *      `./channels/email.ts`. Renders templates per event type.
 *   2. Capacitor Push plugin + APNs wired for push channel —
 *      `sendPush()` in `./channels/push.ts`. iOS-only initially.
 *   3. `notification_log` table for the audit trail (event type,
 *      audience, channels attempted, success/failure, ts).
 *   4. `notification_preferences` table for per-user channel opt-in.
 *      Defaults to email-only on transactional events.
 *   5. Update this dispatcher to route per-channel. Each callsite
 *      stays unchanged.
 *
 * Don't add real senders here without first adding the audit log
 * table + per-user preferences. Without those, you can't honor opt-out
 * (CAN-SPAM, TCPA). The shim's no-op behavior is the safe default.
 */

export interface DispatchResult {
  /** Channels that successfully delivered. Empty in shim mode. */
  delivered: string[];
  /** Channels that were attempted but failed. */
  failed: Array<{ channel: string; error: string }>;
  /** Whether the event was at least logged (always true in shim mode). */
  logged: boolean;
}

/**
 * Dispatch a notification. Currently:
 *   - Logs to server console with a stable prefix (NOTIFY:)
 *   - Returns a DispatchResult with logged=true and delivered=[]
 *
 * Callers should not block on the result for UX — pass-through and
 * fire-and-forget. Failure to log a notification should never break
 * the underlying mutation that triggered it.
 */
export async function dispatchNotification(
  event: NotificationEvent,
): Promise<DispatchResult> {
  const occurredAt = event.occurredAt ?? new Date().toISOString();
  // Single-line structured log so future log aggregators can parse.
  // Don't include PII beyond ids in this log line — see notes in
  // types.ts about under-13 audience.
  // eslint-disable-next-line no-console
  console.log(
    `NOTIFY: ${event.type} [${describeAudience(event.audience)}] @ ${occurredAt} | ${event.title}`,
  );

  // Future: when email/push channels land, call the per-channel
  // senders here. For now, every channel is a no-op.
  const failed: DispatchResult["failed"] = [];
  for (const channel of event.channels) {
    if (channel === "in_app") {
      // In-app is the cheapest first integration. When the inbox
      // grows a "system events" tab, route here.
      // Currently no-op.
      continue;
    }
    // Email/push/sms are deferred. Don't fail loudly here — record
    // the attempt as a soft skip so callsites keep working.
    failed.push({ channel, error: "channel-not-yet-wired" });
  }

  return {
    delivered: [],
    failed,
    logged: true,
  };
}

function describeAudience(audience: NotificationEvent["audience"]): string {
  switch (audience.kind) {
    case "user":
      return `user:${audience.userId.slice(0, 8)}`;
    case "program-coaches":
      return `program-coaches:${audience.programId.slice(0, 8)}`;
    case "head-coach":
      return `head-coach:${audience.programId.slice(0, 8)}`;
    case "athlete-parents":
      return `parents-of:${audience.playerId.slice(0, 8)}`;
    case "athlete":
      return `athlete:${audience.playerId.slice(0, 8)}`;
  }
}

/**
 * Convenience: emit + log without awaiting. For server-action
 * callsites that don't want to await the dispatch (most of them).
 * Errors swallowed — best-effort logging.
 */
export function emit(event: NotificationEvent): void {
  void dispatchNotification(event).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("NOTIFY failed:", err);
  });
}
