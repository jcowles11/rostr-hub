/**
 * Box-score derivation — baseball-correct version.
 *
 * Pure functions over the `game_events` stream. Computes per-player
 * hitter + pitcher lines including the standard rate stats (AVG, OBP,
 * SLG, OPS) and the earned/unearned distinction for pitcher runs.
 *
 * Earned/unearned model:
 *   - Each runner who reaches base carries (a) the responsible pitcher
 *     (the pitcher who put them on) and (b) a `reachedOnError` flag.
 *   - When a runner scores, the run is charged to their responsible
 *     pitcher (not the current one — handles inherited runners).
 *   - The run is EARNED unless one of these holds:
 *       (i) the runner reached on error (origin event was outcome 'E'
 *           OR carried errorOnPlay true on the play they reached)
 *      (ii) the scoring play has errorOnPlay === true (the error caused
 *           THIS run to score)
 *     (iii) the half-inning has already passed its should-have-ended
 *           point (3 outs would have happened without errors)
 *
 * Should-have-ended:
 *   - Walk events in inning order, count `actualOuts` and `missedOuts`:
 *       actualOuts = K, GO, FO, SAC, FC, CS, pickoff
 *       missedOuts = E (reached on error) or any play with errorOnPlay
 *                    that involves a "would-have-been-an-out" outcome.
 *   - Once actualOuts + missedOuts >= 3, mark inningWouldHaveEnded.
 *   - Subsequent runs in that half-inning are unearned.
 *
 * Backward-compatible: when payload fields are absent (older events),
 * fall back to the previous inferred behavior. Forward-only events
 * carry explicit `runScorers` so attribution is exact.
 */

import type { GameEvent } from "@/lib/services/live-scoring";

// ── Types ────────────────────────────────────────────────────────

export interface HitterLine {
  playerId: string;
  // Counting stats
  pa: number;
  ab: number;
  h: number;
  r: number;
  rbi: number;
  bb: number;
  hbp: number;
  k: number;
  // Hit breakdown
  singles: number;
  doubles: number;
  triples: number;
  hr: number;
  // Special outcomes
  sac: number; // SAC bunts
  sf: number; // SAC flies
  roe: number; // reached on error
  gidp: number; // grounded into double play
  ci: number; // catcher's interference (PA only, not AB)
  sb: number; // stolen bases (credited as a runner)
  cs: number; // caught stealing (credited as a runner)
  // Derived totals
  tb: number;
  // Rate stats (0 when AB===0 or denominator is 0)
  avg: number;
  obp: number;
  slg: number;
  ops: number;
}

export interface PitcherLine {
  pitcherId: string;
  outs: number;
  ip: string;
  bf: number;
  h: number;
  hr: number;
  r: number; // total runs allowed
  er: number; // earned runs allowed
  bb: number;
  hbp: number;
  k: number;
  pitches: number;
  /** Earned run average — `9 * ER / IP_decimal` or `27 * ER / outs`. */
  era: number;
}

export interface BoxScore {
  hitters: HitterLine[];
  pitchers: PitcherLine[];
}

// ── Helpers ──────────────────────────────────────────────────────

function isNonAtBatEvent(e: GameEvent): boolean {
  if (e.eventType !== "at_bat") return true;
  const p = e.payload as {
    pickoff?: boolean;
    midGame?: boolean;
    substitution?: boolean;
  };
  return p.pickoff === true || p.midGame === true || p.substitution === true;
}

function outsCausedByOutcome(outcome: string): number {
  // Real at-bats that produce outs.
  // GIDP produces 2 outs (batter + lead force runner).
  // SAC produces an out (the batter is out).
  // FC produces an out (a runner is out, not necessarily the batter).
  if (outcome === "GIDP") return 2;
  return outcome === "K" ||
    outcome === "GO" ||
    outcome === "FO" ||
    outcome === "SAC" ||
    outcome === "FC"
    ? 1
    : 0;
}

function outsCausedByNonAB(payload: Record<string, unknown>): number {
  if ((payload as { pickoff?: boolean }).pickoff === true) return 1;
  const kind = (payload as { midGameKind?: string }).midGameKind;
  if (kind === "caught_stealing") return 1;
  return 0;
}

function isHit(outcome: string): boolean {
  return outcome === "1B" || outcome === "2B" || outcome === "3B" || outcome === "HR";
}

function totalScore(e: GameEvent): number {
  return (e.homeScore ?? 0) + (e.awayScore ?? 0);
}

function basesMap(payload: Record<string, unknown>): Map<string, 1 | 2 | 3> {
  const r = payload.runnersAfter as
    | { 1?: string | null; 2?: string | null; 3?: string | null }
    | undefined;
  const m = new Map<string, 1 | 2 | 3>();
  if (!r) return m;
  if (r[1]) m.set(r[1], 1);
  if (r[2]) m.set(r[2], 2);
  if (r[3]) m.set(r[3], 3);
  return m;
}

/**
 * Resolve the list of player ids who scored on this event. Prefers
 * the explicit `runScorers` field when present (added in the
 * correctness sprint); falls back to inferring from the prior runners
 * disappearing for older events.
 */
function resolveRunScorers(
  e: GameEvent,
  priorBases: Map<string, 1 | 2 | 3>,
  runsThisPlay: number,
): string[] {
  const explicit = (e.payload as { runScorers?: string[] }).runScorers;
  if (Array.isArray(explicit)) return explicit;
  if (runsThisPlay <= 0) return [];
  const currentBases = basesMap(e.payload as Record<string, unknown>);
  const disappeared: string[] = [];
  priorBases.forEach((_b, id) => {
    if (!currentBases.has(id)) disappeared.push(id);
  });
  // For HR with bases empty, batter scored — we can't infer them from
  // bases alone. Fall back: if outcome is HR and runs > disappeared,
  // include the batter id as the trailing scorer.
  const outcome = String((e.payload as { outcome?: string }).outcome ?? "");
  if (outcome === "HR" && e.playerId) {
    const without = disappeared.filter((d) => d !== e.playerId);
    return [...without, e.playerId].slice(0, runsThisPlay);
  }
  return disappeared.slice(0, runsThisPlay);
}

// ── Hitter derivation ────────────────────────────────────────────

export function buildHitterLines(events: GameEvent[]): HitterLine[] {
  const lines = new Map<string, HitterLine>();
  const ensure = (playerId: string): HitterLine => {
    let l = lines.get(playerId);
    if (!l) {
      l = {
        playerId,
        pa: 0, ab: 0, h: 0, r: 0, rbi: 0, bb: 0, hbp: 0, k: 0,
        singles: 0, doubles: 0, triples: 0, hr: 0,
        sac: 0, sf: 0, roe: 0, gidp: 0, ci: 0,
        sb: 0, cs: 0,
        tb: 0, avg: 0, obp: 0, slg: 0, ops: 0,
      };
      lines.set(playerId, l);
    }
    return l;
  };

  let priorBases: Map<string, 1 | 2 | 3> = new Map();
  let priorTotalScore = 0;

  for (const e of events) {
    const payload = e.payload as Record<string, unknown>;
    const outcome = String(payload.outcome ?? "");
    const isAB = !isNonAtBatEvent(e);
    const sacType = (payload as { sacrificeType?: "fly" | "bunt" | null })
      .sacrificeType ?? null;
    const errorOnPlay =
      (payload as { errorOnPlay?: boolean }).errorOnPlay === true;

    const scoreDelta = totalScore(e) - priorTotalScore;
    const runsThisPlay = Math.max(0, scoreDelta);

    if (isAB && e.playerId) {
      const l = ensure(e.playerId);
      l.pa += 1;

      if (outcome === "1B") {
        l.ab += 1; l.h += 1; l.singles += 1;
      } else if (outcome === "2B") {
        l.ab += 1; l.h += 1; l.doubles += 1;
      } else if (outcome === "3B") {
        l.ab += 1; l.h += 1; l.triples += 1;
      } else if (outcome === "HR") {
        l.ab += 1; l.h += 1; l.hr += 1;
      } else if (outcome === "BB") {
        l.bb += 1; // not AB, not a hit
      } else if (outcome === "HBP") {
        l.hbp += 1; // not AB, not a hit
      } else if (outcome === "SAC") {
        // SAC: not AB. Sub-type drives sac fly / sac bunt counters.
        if (sacType === "fly") l.sf += 1;
        else l.sac += 1;
      } else if (outcome === "K") {
        l.ab += 1; l.k += 1;
      } else if (outcome === "GO" || outcome === "FO") {
        l.ab += 1;
      } else if (outcome === "E") {
        // Reached on error — counts as AB but not a hit.
        l.ab += 1; l.roe += 1;
      } else if (outcome === "FC") {
        l.ab += 1; // counts as AB but not a hit
      } else if (outcome === "GIDP") {
        // Grounded into double play. Counts as AB (and as a GIDP) —
        // 2 outs go on the pitcher's line via outsCausedByOutcome.
        l.ab += 1; l.gidp += 1;
      } else if (outcome === "CI") {
        // Catcher's interference: PA only, NOT AB. Doesn't go in BB
        // either — its own counter so OBP can include it correctly.
        l.ci += 1;
      }

      // RBI rules:
      //   - Runs scored on a play credit to the batter EXCEPT:
      //     * Errors that score runs (run is unearned and no RBI).
      //     * GIDP scoring runs typically don't get RBI either (force
      //       run scoring on a DP is the rare exception we ignore).
      //     * SAC bunt scoring runs typically don't get RBI (squeeze
      //       being the exception — coach can record as SAC fly to
      //       force the RBI credit).
      //   - SF DOES credit RBI for the runner that scored from 3rd.
      //   - Walk / HBP with bases loaded credit a forced RBI.
      //   - HR: RBI = 1 (self) + runners that scored.
      if (runsThisPlay > 0) {
        const noRBIOutcomes =
          outcome === "E" || // ROE — no RBI
          outcome === "GIDP" || // DP forced run typically not RBI
          (outcome === "SAC" && sacType === "bunt"); // sac bunt — no RBI by default
        const errorErasesRBI = errorOnPlay && outcome !== "HR" && !isHit(outcome);
        if (!noRBIOutcomes && !errorErasesRBI) {
          l.rbi += runsThisPlay;
        }
      }
    }

    // Credit SB / CS to runners on mid-game events. Skipped when
    // defensiveIndifference is true (runner advanced because the
    // defense didn't contest; not a real SB).
    if (e.eventType === "at_bat") {
      const midKind = (payload as { midGameKind?: string }).midGameKind;
      const di = (payload as { defensiveIndifference?: boolean })
        .defensiveIndifference === true;
      const runnerId = e.playerId; // mid-game events use runner as player_id
      if (runnerId && midKind === "stolen_base" && !di) {
        ensure(runnerId).sb += 1;
      }
      if (runnerId && midKind === "caught_stealing") {
        ensure(runnerId).cs += 1;
      }
    }

    // Credit RUN to each scorer (regardless of who batted).
    const scorers = resolveRunScorers(e, priorBases, runsThisPlay);
    for (const sid of scorers) {
      // For HR, we credit one R to the batter via the explicit runScorers
      // list which already includes them. No double-credit.
      ensure(sid).r += 1;
    }

    priorBases = basesMap(payload);
    priorTotalScore = totalScore(e);
  }

  // Finalize derived stats.
  const all = Array.from(lines.values());
  for (const l of all) {
    l.tb = l.singles + l.doubles * 2 + l.triples * 3 + l.hr * 4;
    l.avg = l.ab > 0 ? round3(l.h / l.ab) : 0;
    const obpDen = l.ab + l.bb + l.hbp + l.sf;
    l.obp = obpDen > 0 ? round3((l.h + l.bb + l.hbp) / obpDen) : 0;
    l.slg = l.ab > 0 ? round3(l.tb / l.ab) : 0;
    l.ops = round3(l.obp + l.slg);
  }
  return all.sort((a, b) => b.pa - a.pa || b.h - a.h);
}

// ── Pitcher derivation (with ER + inherited runners) ────────────

interface RunnerOrigin {
  /** Pitcher responsible if this runner scores. */
  pitcherId: string;
  /** Was this runner placed on base via an error (or with errorOnPlay)?
   *  Their run is unearned. */
  reachedOnError: boolean;
}

interface InningTracker {
  actualOuts: number;
  missedOuts: number;
  /** Once true, all subsequent runs in this half-inning are unearned. */
  wouldHaveEnded: boolean;
}

function newInning(): InningTracker {
  return { actualOuts: 0, missedOuts: 0, wouldHaveEnded: false };
}

function inningKey(e: GameEvent): string {
  return `${e.inning ?? 0}-${e.topBottom ?? "top"}`;
}

/**
 * Build per-pitcher lines.
 *
 * The walk:
 *   - Maintain a `runnerOrigin` map: playerId → { pitcherId,
 *     reachedOnError } at the moment they reached base. Stays set
 *     across pitching changes (inherited-runner rule).
 *   - Maintain a per-half-inning tracker for "would have ended" logic.
 *   - For each event:
 *       * If it carries scorers, credit each scorer's run to their
 *         responsible pitcher (from origin map). Decide earned/unearned
 *         based on (runner reachedOnError) || (event errorOnPlay) ||
 *         (inning wouldHaveEnded already).
 *       * Update the origin map: any new runner on base after this
 *         event gets origin = current pitcher + reachedOnError flag.
 *       * Update the inning tracker: bump actual or missed outs.
 */
export function buildPitcherLines(events: GameEvent[]): PitcherLine[] {
  const lines = new Map<string, PitcherLine>();
  const ensure = (id: string): PitcherLine => {
    let l = lines.get(id);
    if (!l) {
      l = {
        pitcherId: id,
        outs: 0, ip: "0.0", bf: 0,
        h: 0, hr: 0, r: 0, er: 0,
        bb: 0, hbp: 0, k: 0, pitches: 0, era: 0,
      };
      lines.set(id, l);
    }
    return l;
  };

  const runnerOrigin = new Map<string, RunnerOrigin>();
  const innings = new Map<string, InningTracker>();
  let priorBases: Map<string, 1 | 2 | 3> = new Map();
  let priorTotalScore = 0;

  for (const e of events) {
    const payload = e.payload as Record<string, unknown>;
    const pitcherId = (payload as { pitcherId?: string | null }).pitcherId;
    const outcome = String(payload.outcome ?? "");
    const isAB = !isNonAtBatEvent(e);
    const errorOnPlay = (payload as { errorOnPlay?: boolean }).errorOnPlay === true;
    const reachedOnError = outcome === "E" || (errorOnPlay && batterReached(outcome));

    const ikey = inningKey(e);
    let inning = innings.get(ikey);
    if (!inning) {
      inning = newInning();
      innings.set(ikey, inning);
    }

    // 1. Compute scoring runs FIRST (so they're charged before this
    //    event itself bumps the inning tracker — runs that scored on
    //    this play are evaluated against the inning state BEFORE the
    //    play's outs are added).
    const scoreDelta = totalScore(e) - priorTotalScore;
    const runsThisPlay = Math.max(0, scoreDelta);
    const scorers = resolveRunScorers(e, priorBases, runsThisPlay);

    for (const sid of scorers) {
      const origin = runnerOrigin.get(sid);
      if (!origin) {
        // No origin known (shouldn't normally happen for HR-batter
        // because we set their origin below; skip safely).
        // For runners who appeared without an origin (legacy events),
        // attribute to the current pitcher.
        if (pitcherId) {
          const line = ensure(pitcherId);
          line.r += 1;
          if (!inning.wouldHaveEnded && !errorOnPlay) line.er += 1;
        }
        continue;
      }
      const line = ensure(origin.pitcherId);
      line.r += 1;
      const isUnearned =
        origin.reachedOnError ||
        errorOnPlay ||
        inning.wouldHaveEnded;
      if (!isUnearned) line.er += 1;
      // Remove from origin map — they've scored.
      runnerOrigin.delete(sid);
    }

    // 2. Now bump pitcher counters tied to THIS event (BF, K, BB, etc.).
    if (pitcherId) {
      const line = ensure(pitcherId);
      if (isAB) {
        line.bf += 1;
        if (isHit(outcome)) line.h += 1;
        if (outcome === "HR") line.hr += 1;
        if (outcome === "BB") line.bb += 1;
        if (outcome === "HBP") line.hbp += 1;
        if (outcome === "K") line.k += 1;
      }
      if (isAB) line.outs += outsCausedByOutcome(outcome);
      else line.outs += outsCausedByNonAB(payload);
      const pitches = payload.pitches as Array<unknown> | undefined;
      if (Array.isArray(pitches)) line.pitches += pitches.length;
    }

    // 3. Update the runner-origin map for runners now on base. New
    //    arrivals (vs priorBases) get origin = current pitcher with
    //    appropriate reachedOnError flag.
    const currentBases = basesMap(payload);
    currentBases.forEach((_b, id) => {
      if (priorBases.has(id)) return; // already on base — keep existing origin
      // New runner — set origin.
      if (pitcherId) {
        runnerOrigin.set(id, {
          pitcherId,
          reachedOnError: id === e.playerId ? reachedOnError : false,
        });
      }
    });
    // Runners no longer on base who DIDN'T score (e.g. caught stealing,
    // pickoff): clear their origin.
    priorBases.forEach((_b, id) => {
      if (!currentBases.has(id) && !scorers.includes(id)) {
        runnerOrigin.delete(id);
      }
    });

    // 4. Update inning out tracking. Done AFTER scoring so a run that
    //    scored on this play is evaluated against the inning state
    //    BEFORE this play's outs added — important for the
    //    "should-have-ended" rule.
    if (isAB) {
      inning.actualOuts += outsCausedByOutcome(outcome);
      // Missed-out count: ROE (E) is automatically 1; errorOnPlay on a
      // would-have-been-out play adds errorsOnPlay (default 1, but
      // multi-error plays bump it more).
      const errorsOnPlay =
        (payload as { errorsOnPlay?: number }).errorsOnPlay ??
        (errorOnPlay ? 1 : 0);
      if (outcome === "E") {
        // E is one missed out by definition (batter would have been
        // thrown out). Additional errors on the same play add more.
        inning.missedOuts += Math.max(1, errorsOnPlay);
      } else if (
        errorsOnPlay > 0 &&
        outsCausedByOutcome(outcome) === 0 &&
        batterReached(outcome)
      ) {
        inning.missedOuts += errorsOnPlay;
      }
    } else {
      inning.actualOuts += outsCausedByNonAB(payload);
    }
    if (!inning.wouldHaveEnded && inning.actualOuts + inning.missedOuts >= 3) {
      inning.wouldHaveEnded = true;
    }

    priorBases = currentBases;
    priorTotalScore = totalScore(e);
  }

  for (const l of Array.from(lines.values())) {
    l.ip = formatIP(l.outs);
    // ERA = 9 * ER / IP_decimal where IP_decimal = outs/3.
    // Equivalently: ERA = (27 * ER) / outs. Rounded to 2 decimals.
    l.era = l.outs > 0 ? Math.round((27 * l.er * 100) / l.outs) / 100 : 0;
  }
  return Array.from(lines.values()).sort((a, b) => b.outs - a.outs);
}

/** True when this outcome puts the batter on base. */
function batterReached(outcome: string): boolean {
  return (
    outcome === "1B" ||
    outcome === "2B" ||
    outcome === "3B" ||
    outcome === "HR" ||
    outcome === "BB" ||
    outcome === "HBP" ||
    outcome === "E" ||
    outcome === "FC"
  );
}

function formatIP(outs: number): string {
  const innings = Math.floor(outs / 3);
  const partial = outs % 3;
  return `${innings}.${partial}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ── Combined ─────────────────────────────────────────────────────

export function buildBoxScore(events: GameEvent[]): BoxScore {
  return {
    hitters: buildHitterLines(events),
    pitchers: buildPitcherLines(events),
  };
}

// ── Summary helpers ──────────────────────────────────────────────

export interface KeyPerformer {
  playerId: string;
  line: string;
  score: number;
}

export function getKeyPerformers(box: BoxScore): KeyPerformer[] {
  const performers: KeyPerformer[] = [];
  for (const h of box.hitters) {
    if (h.pa === 0) continue;
    const score =
      h.hr * 4 +
      h.triples * 3 +
      h.doubles * 2 +
      h.singles +
      h.rbi +
      h.r * 0.5 -
      h.k * 0.5;
    performers.push({
      playerId: h.playerId,
      line: hitterLineSummary(h),
      score,
    });
  }
  for (const p of box.pitchers) {
    if (p.outs === 0) continue;
    // Use ER (not R) so a pitcher unfairly charged for unearned runs
    // isn't punished in the rankings.
    const score = p.k - p.h * 0.5 - p.bb * 0.5 - p.er * 1.5 + p.outs * 0.7;
    performers.push({
      playerId: p.pitcherId,
      line: pitcherLineSummary(p),
      score,
    });
  }
  performers.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const top: KeyPerformer[] = [];
  for (const p of performers) {
    if (seen.has(p.playerId)) continue;
    seen.add(p.playerId);
    top.push(p);
    if (top.length >= 3) break;
  }
  return top;
}

export function hitterLineSummary(h: HitterLine): string {
  const parts: string[] = [`${h.h}-for-${Math.max(h.ab, h.h)}`];
  if (h.hr > 0) parts.push(`${h.hr} HR`);
  else if (h.triples > 0) parts.push(`${h.triples} 3B`);
  else if (h.doubles > 0) parts.push(`${h.doubles} 2B`);
  if (h.rbi > 0) parts.push(`${h.rbi} RBI`);
  if (h.bb > 0 && h.h === 0) parts.push(`${h.bb} BB`);
  if (h.hbp > 0 && h.h === 0) parts.push(`${h.hbp} HBP`);
  if (h.r >= 2) parts.push(`${h.r} R`);
  if (h.h === 0 && h.k > 0 && h.bb === 0 && h.hbp === 0) parts.push(`${h.k} K`);
  return parts.join(", ");
}

export function pitcherLineSummary(p: PitcherLine): string {
  const parts: string[] = [`${p.ip} IP`];
  if (p.k > 0) parts.push(`${p.k} K`);
  if (p.h > 0) parts.push(`${p.h} H`);
  if (p.r > 0) {
    if (p.er !== p.r) parts.push(`${p.r}R / ${p.er}ER`);
    else parts.push(`${p.r} R`);
  }
  if (p.bb > 0) parts.push(`${p.bb} BB`);
  return parts.join(", ");
}

export function gameHeadline(
  ourScore: number,
  theirScore: number,
  programName: string,
  performers: KeyPerformer[],
  nameFor: (playerId: string) => string,
): string {
  const result =
    ourScore > theirScore ? "Win" : ourScore < theirScore ? "Loss" : "Tie";
  const score = `${ourScore}-${theirScore}`;
  if (performers.length === 0) {
    return `${result} ${score}`;
  }
  const top = performers[0];
  const topName = nameFor(top.playerId);
  if (result === "Tie") {
    return `${score} tie · ${topName} — ${top.line}`;
  }
  return `${result} ${score} — ${topName} (${top.line})`;
}

/** Format a rate stat (AVG/OBP/SLG/OPS) as ".318" or "1.000". */
export function formatRate(n: number): string {
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, "");
}

/** Format ERA as "3.21" or "—" when no innings pitched. */
export function formatERA(era: number, outs: number): string {
  if (outs === 0) return "—";
  // ERAs above 99.99 usually indicate "infinite" (1+ ER, 0 outs handled
  // above so we won't reach there). Cap display at 99.99 for sanity.
  const capped = Math.min(99.99, era);
  return capped.toFixed(2);
}
