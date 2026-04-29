/**
 * Tiny haptic-feedback helper.
 *
 * Web Vibration API is supported on Android Chrome / Firefox / Edge /
 * Samsung Internet, but NOT on iOS Safari (Apple deliberately blocks
 * it for non-native apps). On iOS we silently no-op — the loss is
 * minor since iPhones still get the visual press-down via active:scale.
 *
 * Use sparingly. Buzzing on every tap is exhausting. Save it for:
 *   - Bottom-nav tab switches (one bzzt per navigation)
 *   - FAB tap (gives the "I'm definitely about to do something" feel)
 *   - Critical confirmations (delete, finalize lineup, send announcement)
 */
export function tapHaptic(durationMs = 8): void {
  if (typeof navigator === "undefined") return;
  if (!("vibrate" in navigator)) return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    // Safari throws on unsupported / user-gesture-required contexts;
    // failing silent is correct.
  }
}

/** Slightly heavier — for FAB taps and successful submits. */
export function thumpHaptic(): void {
  tapHaptic(15);
}

/** Pattern for an error / failure event — short double-buzz. */
export function errorHaptic(): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    navigator.vibrate([12, 40, 12]);
  } catch {
    /* no-op */
  }
}
