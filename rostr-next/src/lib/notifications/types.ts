/**
 * Notification event types — the shape every Rostr-internal "something
 * happened, the user should know" emits.
 *
 * This module is **types only**. It defines the contract; the actual
 * dispatch happens in `./dispatch.ts`. The split lets pure-types
 * imports work in client components without dragging server-only
 * dependencies along.
 *
 * Pre-implementation rules:
 *   - Notifications are designed FIRST in this file.
 *   - Code emits notifications by calling `dispatchNotification(event)`
 *     in dispatch.ts (currently a no-op shim that logs).
 *   - When the email/APNs integrations land, the shim grows real
 *     senders without changing any callsite.
 *
 * Channel preferences (web push, email, SMS) live on a future
 * `notification_preferences` table per user. Until that exists,
 * dispatch is no-op + logged.
 */

/** Stable event types. Adding a new one = add a case here + handler in dispatch.ts. */
export type NotificationEventType =
  | "practice_changed"
  | "game_changed"
  | "lineup_posted"
  | "highlight_verified"
  | "player_profile_consent_requested"
  | "tryout_score_entered"
  | "verification_requested" // coach-facing: athlete asked for review
  | "consent_granted" // coach-facing: parent OK'd the profile
  | "takedown_requested" // coach + admin: parent asked for removal
  | "weekly_digest"; // optional periodic summary

/**
 * Audience for a notification. A single event can target one or many
 * people. `program-coaches` = every coach in the program; `parents` =
 * parents of affected players (resolved at dispatch time via
 * parental_consent.parent_email).
 */
export type NotificationAudience =
  | { kind: "user"; userId: string }
  | { kind: "program-coaches"; programId: string }
  | { kind: "head-coach"; programId: string }
  | { kind: "athlete-parents"; playerId: string }
  | { kind: "athlete"; playerId: string };

/**
 * Channels we'll eventually deliver through. Each channel grows its
 * own implementation:
 *   - email   → Resend (planned)
 *   - push    → APNs / FCM via Capacitor plugin (planned)
 *   - in_app  → on-page banner / inbox row (Inbox UI exists; this is
 *               where in-app notifications surface)
 *   - sms     → Twilio (planned, only for opted-in safety alerts)
 */
export type NotificationChannel = "email" | "push" | "in_app" | "sms";

/**
 * The serializable event payload. Everything here goes into the
 * dispatch log and (eventually) into the email/push body.
 *
 * Don't put PII in `context` for under-13 audiences. Use ids and let
 * the renderer fetch names server-side under the right RLS context.
 */
export interface NotificationEvent {
  type: NotificationEventType;
  /** Who should receive this. Resolved by dispatch.ts. */
  audience: NotificationAudience;
  /**
   * Channels to attempt. Dispatch may filter further based on user
   * preferences + channel availability. Pass `["in_app"]` for
   * coach-internal events that don't need email/push.
   */
  channels: NotificationChannel[];
  /** Short human-readable line for in-app + email subject. */
  title: string;
  /** Optional longer body. Plain text; renderer wraps for email. */
  body?: string;
  /** Optional deep-link path back into Rostr. */
  link?: string;
  /** Free-form ids for later renderer / analytics joins. */
  context?: {
    programId?: string;
    playerId?: string;
    gameId?: string;
    practiceId?: string;
    tryoutId?: string;
    highlightId?: string;
    consentId?: string;
    [key: string]: unknown;
  };
  /** When the event happened. Defaults to dispatch-time. */
  occurredAt?: string;
}

/**
 * Helper builders — strongly typed factories so callsites stay terse
 * and tsc catches missing fields. Add one per event type.
 */
export const notify = {
  practiceChanged(args: {
    programId: string;
    practiceId: string;
    title: string;
    body: string;
  }): NotificationEvent {
    return {
      type: "practice_changed",
      audience: { kind: "program-coaches", programId: args.programId },
      channels: ["in_app", "email"],
      title: args.title,
      body: args.body,
      link: `/app/practice`,
      context: { programId: args.programId, practiceId: args.practiceId },
    };
  },
  gameChanged(args: {
    programId: string;
    gameId: string;
    title: string;
    body: string;
  }): NotificationEvent {
    return {
      type: "game_changed",
      audience: { kind: "program-coaches", programId: args.programId },
      channels: ["in_app", "email"],
      title: args.title,
      body: args.body,
      link: `/app/games/${args.gameId}`,
      context: { programId: args.programId, gameId: args.gameId },
    };
  },
  lineupPosted(args: {
    programId: string;
    gameId: string;
    title: string;
  }): NotificationEvent {
    return {
      type: "lineup_posted",
      audience: { kind: "program-coaches", programId: args.programId },
      channels: ["in_app", "push"],
      title: args.title,
      link: `/app/games/${args.gameId}`,
      context: { programId: args.programId, gameId: args.gameId },
    };
  },
  highlightVerified(args: {
    playerId: string;
    highlightId: string;
    coachName: string;
  }): NotificationEvent {
    return {
      type: "highlight_verified",
      audience: { kind: "athlete", playerId: args.playerId },
      channels: ["in_app", "email"],
      title: `Coach ${args.coachName} verified your highlight`,
      body: "Your verified highlight is now visible to recruiters who view your profile.",
      link: `/me/profile`,
      context: { playerId: args.playerId, highlightId: args.highlightId },
    };
  },
  consentRequested(args: {
    playerId: string;
    consentId: string;
    parentEmail: string;
    playerName: string;
  }): NotificationEvent {
    return {
      type: "player_profile_consent_requested",
      audience: { kind: "athlete-parents", playerId: args.playerId },
      channels: ["email"],
      title: `Authorize ${args.playerName}'s Rostr profile`,
      body: `A coach has requested your authorization to publish ${args.playerName}'s player profile. Click the link to review.`,
      link: `/consent/[token]`, // dispatch fills the token
      context: {
        playerId: args.playerId,
        consentId: args.consentId,
      },
    };
  },
  tryoutScoreEntered(args: {
    programId: string;
    tryoutId: string;
    playerName: string;
    stationName: string;
    scoredBy: string;
  }): NotificationEvent {
    return {
      type: "tryout_score_entered",
      audience: { kind: "head-coach", programId: args.programId },
      channels: ["in_app"],
      title: `${args.scoredBy} scored ${args.playerName} — ${args.stationName}`,
      link: `/app/tryouts/${args.tryoutId}`,
      context: {
        programId: args.programId,
        tryoutId: args.tryoutId,
      },
    };
  },
  consentGranted(args: {
    programId: string;
    playerId: string;
    consentId: string;
    playerName: string;
    scopes: string[];
  }): NotificationEvent {
    return {
      type: "consent_granted",
      audience: { kind: "program-coaches", programId: args.programId },
      channels: ["in_app"],
      title: `Parent authorized ${args.playerName}'s profile`,
      body: `Granted: ${args.scopes.join(", ") || "(no scopes)"}`,
      link: `/app/roster/${args.playerId}/reported`,
      context: {
        programId: args.programId,
        playerId: args.playerId,
        consentId: args.consentId,
      },
    };
  },
  takedownRequested(args: {
    programId: string;
    playerId: string;
    playerName: string;
    reason?: string;
  }): NotificationEvent {
    return {
      type: "takedown_requested",
      audience: { kind: "head-coach", programId: args.programId },
      channels: ["in_app", "email"],
      title: `Takedown request — ${args.playerName}`,
      body:
        args.reason ??
        "A parent has requested removal of their athlete's data. Visibility cut automatically; review for full deletion.",
      link: `/app/roster/${args.playerId}/reported`,
      context: { programId: args.programId, playerId: args.playerId },
    };
  },
};
