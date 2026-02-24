

## Problem Analysis

Two issues are causing the player experience to break:

### Issue 1: Bottom navigation bar is hidden on desktop
The `UnifiedNavShell` bottom nav has `sm:hidden` (line 107), meaning it only renders on screens narrower than 640px. Since the preview is likely wider than that, the bottom nav (Feed, Search, Alerts, Profile) is invisible.

**Fix:** Remove the `sm:hidden` class so the bottom nav shows on all screen sizes for non-coach roles. Alternatively, render a desktop-friendly version of the same nav on larger screens (e.g., a horizontal bar at the bottom or a sidebar). The simplest fix is to always show the bottom nav bar regardless of screen size.

### Issue 2: Onboarding splash only shows in demo mode
In `SocialPage.tsx`, line 86-91, the splash is gated by `devRoleOverride === "player"`. Real player accounts never see it.

**Fix:** Show the onboarding splash for both demo players AND real players who haven't completed onboarding. Use `userRole === "player"` as an additional trigger, and persist the "seen" flag per-user (e.g., `localStorage` keyed by user ID) so it only shows once.

---

## Implementation Plan

### 1. Fix bottom nav visibility in `UnifiedNavShell.tsx`
- Remove `sm:hidden` from the bottom nav container so it shows on all screen sizes
- Adjust the main content padding (`pb-20 sm:pb-8` → `pb-20`) so content doesn't get hidden behind the nav on desktop too

### 2. Fix onboarding splash in `SocialPage.tsx`
- Change the splash trigger from `devRoleOverride === "player"` to `effectiveRole === "player"` (where `effectiveRole = devRoleOverride || userRole`)
- This ensures real player accounts also see the welcome splash on first visit
- Keep the `sessionStorage` persistence so it only shows once per session

### 3. Files to modify
- `src/components/UnifiedNavShell.tsx` — remove `sm:hidden` from nav, fix padding
- `src/pages/SocialPage.tsx` — use `effectiveRole` for splash trigger

