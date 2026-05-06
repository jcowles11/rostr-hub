# Notifications

**Status:** scaffolding only. No real send wired.

## What's here

- `types.ts` — event types, audience kinds, channels, factories (`notify.practiceChanged(...)`, `notify.consentGranted(...)`, etc.)
- `dispatch.ts` — `dispatchNotification(event)` + `emit(event)` — currently a no-op shim that logs to console. Callers can emit events today; senders wire up later without changing call sites.

## How to add a notification today

```ts
// In any server action:
import { emit } from "@/lib/notifications/dispatch";
import { notify } from "@/lib/notifications/types";

emit(
  notify.consentGranted({
    programId: coach.program_id,
    playerId: player.id,
    consentId: consent.id,
    playerName: `${player.first_name} ${player.last_name}`,
    scopes: consent.consent_scope,
  }),
);
```

The emit is fire-and-forget. Logs to server console. No user-visible side effect today.

## When real senders are wired

Migration path (in order):

### Step 1 — In-app system inbox

Cheapest integration. Add a "System" tab to the existing `/app/messages` inbox. Route `in_app` channel events to a new `system_notifications` table per-user. UI reads from that table. Estimated effort: ~3 days.

### Step 2 — Email channel via Resend

Wire `lib/notifications/channels/email.ts` with Resend SDK. Render templates per event type. Add `notification_preferences` table for per-user opt-in (default: transactional ON, marketing OFF). Add `notification_log` for delivery audit trail. Estimated effort: ~1 week.

### Step 3 — Push channel via Capacitor + APNs

Available only after Capacitor wrapper ships. Wire `lib/notifications/channels/push.ts` with Capacitor Push plugin. Server-side: send via APNs HTTP/2 API. Each user's push token stored on user record. Estimated effort: ~1 week (mostly Apple cert + provisioning ceremony).

### Step 4 — SMS via Twilio (optional, much later)

Only for opted-in safety alerts (e.g. "practice canceled due to weather"). TCPA-compliant double opt-in flow required. Estimated effort: ~1 week.

## What NOT to do

- **Don't add a real sender to dispatch.ts without first adding the audit log + per-user preferences tables.** Without those, you can't honor opt-out (CAN-SPAM §316.5, TCPA prior-express-written-consent rule). The shim's no-op default is the safe state.
- **Don't put PII in the `context` field for under-13 audiences.** Use ids only; let the renderer fetch names server-side under proper RLS context.
- **Don't await `emit()` in a server action's critical path.** Notification failure must never break the underlying mutation.

## Compliance notes

This module's design enforces several COMPLIANCE.md commitments:

- §15a marketing-vs-consent — notifications use the same scopes as the public profile gates. A scope-revoked parent stops getting `consent_granted` echoes.
- §11 data subject rights — notification audit log (when wired) becomes part of a parent's right-to-access export.
- §15h AI-assisted compliance review — every new event type added to `types.ts` should be reviewed against the active marketing claims to avoid creating a deceptive-practices vector.
