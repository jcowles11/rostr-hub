// @ts-check
/**
 * seed-live-game.mjs
 *
 * Takes the coach's next scheduled varsity game and simulates a full
 * game via the game_events log — realistic outcome distribution, 7
 * innings, real score progression. Powers the fan-viewer demo AND
 * feeds player_batting_stats with real per-AB data.
 *
 * Also seeds simulated history: picks 8 already-completed varsity
 * games and replays them as event streams so batting stats have
 * meaningful sample size across every regular.
 */

import { createClient } from "@supabase/supabase-js";

const URL = "https://fubylvgkvnjjrpvdavjy.supabase.co";
const SERVICE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1Ynlsdmdrdm5qanJwdmRhdmp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3MTU5OCwiZXhwIjoyMDg5MjQ3NTk4fQ.rs0aiShj2COBIcn484pJsRO4Hphr9PX2QTV3gpxVNZI";

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Weighted outcome distribution — roughly matches HS varsity baseball
// at-bat rates (league BA ~.300, BB ~10%, K ~20%).
const OUTCOMES = [
  { outcome: "GO", weight: 22, isOut: true },
  { outcome: "K", weight: 18, isOut: true },
  { outcome: "FO", weight: 15, isOut: true },
  { outcome: "1B", weight: 14, isOut: false },
  { outcome: "BB", weight: 10, isOut: false },
  { outcome: "2B", weight: 5, isOut: false },
  { outcome: "E", weight: 4, isOut: false },
  { outcome: "FC", weight: 3, isOut: true },
  { outcome: "HR", weight: 3, isOut: false },
  { outcome: "HBP", weight: 2, isOut: false },
  { outcome: "3B", weight: 2, isOut: false },
  { outcome: "SAC", weight: 2, isOut: true },
];
const TOTAL_WEIGHT = OUTCOMES.reduce((s, o) => s + o.weight, 0);

function pickOutcome() {
  let r = Math.random() * TOTAL_WEIGHT;
  for (const o of OUTCOMES) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return OUTCOMES[0];
}

// Simulate a single half-inning where OUR pitcher is on the mound —
// generates opponent at-bats (ad-hoc batters) so the pitching views
// have data to aggregate. Each at_bat gets attributed via the most-
// recent pitcher_change in the event log.
function simulateOpponentHalfInning({
  inning,
  topBottom,
  startingHomeScore,
  startingAwayScore,
  isHomeFielding, // true if OUR team is home; opponent bats top if so
  sequenceStart,
  gameId,
  coachUserId,
  opponentNamePrefix,
}) {
  const events = [];
  let outs = 0;
  let homeScore = startingHomeScore;
  let awayScore = startingAwayScore;
  let runners = 0;
  let seq = sequenceStart;
  let batterNum = 1;

  while (outs < 3 && events.length < 12) {
    const outcome = pickOutcome();
    let rbi = 0;

    if (outcome.isOut) {
      outs++;
      if (outcome.outcome === "SAC" && runners >= 1) {
        rbi = 1;
        runners = Math.max(0, runners - 1);
      }
    } else {
      if (outcome.outcome === "HR") {
        rbi = runners + 1;
        if (isHomeFielding) awayScore += runners + 1;
        else homeScore += runners + 1;
        runners = 0;
      } else if (outcome.outcome === "3B") {
        rbi = runners;
        if (isHomeFielding) awayScore += runners;
        else homeScore += runners;
        runners = 1;
      } else if (outcome.outcome === "2B") {
        rbi = Math.min(runners, 2);
        if (isHomeFielding) awayScore += rbi;
        else homeScore += rbi;
        runners = Math.max(1, runners - rbi + 1);
      } else if (outcome.outcome === "1B") {
        rbi = runners >= 2 ? 1 : 0;
        if (isHomeFielding) awayScore += rbi;
        else homeScore += rbi;
        runners = Math.min(3, runners + 1);
      } else {
        if (runners >= 3) {
          rbi = 1;
          if (isHomeFielding) awayScore += 1;
          else homeScore += 1;
          runners = 3;
        } else {
          runners = runners + 1;
        }
      }
    }

    events.push({
      game_id: gameId,
      sequence: seq++,
      event_type: "at_bat",
      inning,
      top_bottom: topBottom,
      outs_after: outs,
      home_score: homeScore,
      away_score: awayScore,
      player_id: null,
      player_ad_hoc_name: `${opponentNamePrefix} Batter ${batterNum}`,
      payload: { outcome: outcome.outcome, rbi },
      logged_by: coachUserId,
      logged_by_side: "home",
    });

    batterNum++;
  }

  return {
    events,
    homeScore,
    awayScore,
    nextSeq: seq,
  };
}

// Simulate a single half-inning for a lineup — returns events + updated batting index.
function simulateHalfInning({
  lineup,
  batterStartIdx,
  inning,
  topBottom,
  startingHomeScore,
  startingAwayScore,
  isHomeBatting,
  sequenceStart,
  gameId,
  coachUserId,
}) {
  const events = [];
  let outs = 0;
  let batterIdx = batterStartIdx;
  let homeScore = startingHomeScore;
  let awayScore = startingAwayScore;
  // Very simplified baserunner model — track count of runners for RBI calculation
  let runners = 0;
  let seq = sequenceStart;

  while (outs < 3 && events.length < 12) {
    // safety
    const batter = lineup[batterIdx % lineup.length];
    const outcome = pickOutcome();
    let rbi = 0;

    if (outcome.isOut) {
      outs++;
      // SAC can drive in a run if runner on 3rd
      if (outcome.outcome === "SAC" && runners >= 1) {
        rbi = 1;
        runners = Math.max(0, runners - 1);
      }
    } else {
      // Hits and walks advance runners
      if (outcome.outcome === "HR") {
        rbi = runners + 1;
        if (isHomeBatting) homeScore += runners + 1;
        else awayScore += runners + 1;
        runners = 0;
      } else if (outcome.outcome === "3B") {
        rbi = runners;
        if (isHomeBatting) homeScore += runners;
        else awayScore += runners;
        runners = 1;
      } else if (outcome.outcome === "2B") {
        rbi = Math.min(runners, 2);
        if (isHomeBatting) homeScore += rbi;
        else awayScore += rbi;
        runners = Math.max(1, runners - rbi + 1);
      } else if (outcome.outcome === "1B") {
        rbi = runners >= 2 ? 1 : 0;
        if (isHomeBatting) homeScore += rbi;
        else awayScore += rbi;
        runners = Math.min(3, runners + 1);
      } else {
        // BB, HBP, E — add runner, no RBI unless bases loaded
        if (runners >= 3) {
          rbi = 1;
          if (isHomeBatting) homeScore += 1;
          else awayScore += 1;
          runners = 3;
        } else {
          runners = runners + 1;
        }
      }
    }

    events.push({
      game_id: gameId,
      sequence: seq++,
      event_type: "at_bat",
      inning,
      top_bottom: topBottom,
      outs_after: outs,
      home_score: homeScore,
      away_score: awayScore,
      player_id: batter.player_id,
      payload: { outcome: outcome.outcome, rbi },
      logged_by: coachUserId,
      logged_by_side: "home",
    });

    batterIdx++;
  }

  return {
    events,
    batterIdx,
    homeScore,
    awayScore,
    nextSeq: seq,
  };
}

async function simulateFullGame({ game, coach, isLive, backdateDaysAgo }) {
  // Pull or build lineup
  const { data: lineupRes } = await svc
    .from("lineup_entries")
    .select("player_id, batting_order, position")
    .eq("game_id", game.id)
    .order("batting_order", { ascending: true });
  let lineup = lineupRes ?? [];
  if (lineup.length === 0) {
    // Auto-seed a 9-slot lineup from this level's roster
    const levelLower = (game.team_level ?? "").toLowerCase();
    const { data: assignments } = await svc
      .from("roster_assignments")
      .select("player_id")
      .eq("program_id", coach.program_id)
      .eq("assignment", levelLower)
      .limit(9);
    if (!assignments || assignments.length < 9) {
      // Fall back to any 9 players
      const { data: anyPlayers } = await svc
        .from("players")
        .select("id")
        .eq("program_id", coach.program_id)
        .limit(9);
      if (!anyPlayers || anyPlayers.length < 9) {
        throw new Error("Not enough players to seed a lineup");
      }
      const positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
      const rows = anyPlayers.slice(0, 9).map((p, i) => ({
        game_id: game.id,
        player_id: p.id,
        batting_order: i + 1,
        position: positions[i],
      }));
      await svc.from("lineup_entries").insert(rows);
      await svc.from("game_rosters").upsert(
        anyPlayers.slice(0, 9).map((p) => ({
          game_id: game.id,
          player_id: p.id,
          status: "active",
        })),
        { onConflict: "game_id,player_id" },
      );
      lineup = rows;
    } else {
      const positions = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
      const rows = assignments.slice(0, 9).map((a, i) => ({
        game_id: game.id,
        player_id: a.player_id,
        batting_order: i + 1,
        position: positions[i],
      }));
      await svc.from("lineup_entries").insert(rows);
      await svc.from("game_rosters").upsert(
        assignments.slice(0, 9).map((a) => ({
          game_id: game.id,
          player_id: a.player_id,
          status: "active",
        })),
        { onConflict: "game_id,player_id" },
      );
      lineup = rows;
    }
  }

  // Wipe any previous events for idempotency
  await svc.from("game_events").delete().eq("game_id", game.id);

  // Base timestamp — backdate if a past game, now-ish if live
  const baseTime = backdateDaysAgo != null
    ? new Date(Date.now() - backdateDaysAgo * 864e5).getTime()
    : Date.now() - 60 * 60 * 1000;

  const events = [];
  let seq = 1;
  events.push({
    game_id: game.id,
    sequence: seq++,
    event_type: "game_start",
    home_score: 0,
    away_score: 0,
    payload: {},
    logged_by: coach.user_id,
    logged_by_side: "home",
    created_at: new Date(baseTime).toISOString(),
  });

  // Pick a starter (position=P in lineup) and a reliever (another
  // pitcher on roster, or a fallback). The starter gets a
  // pitcher_change event right after game_start so the pitching view
  // has a clear attribution anchor.
  const starter = lineup.find((l) => l.position === "P") ?? lineup[0];
  // Pull a second pitcher for late-game relief
  const { data: otherPitchers } = await svc
    .from("players")
    .select("id")
    .eq("program_id", coach.program_id)
    .neq("id", starter.player_id)
    .limit(1);
  const relieverId = otherPitchers?.[0]?.id ?? starter.player_id;

  events.push({
    game_id: game.id,
    sequence: seq++,
    event_type: "pitcher_change",
    home_score: 0,
    away_score: 0,
    payload: { new_pitcher_id: starter.player_id },
    logged_by: coach.user_id,
    logged_by_side: "home",
  });

  // Simulate 7 innings. We now generate BOTH our at-bats (real
  // player_id) AND opponent at-bats (ad-hoc names), so the batting
  // views pick up our hitters and the pitching views pick up our
  // starter/reliever.
  const isHome = game.home_away === "home";
  let homeScore = 0;
  let awayScore = 0;
  let ourBatterIdx = 0;
  let pitcherSwapped = false;
  const opponentNamePrefix = (game.opponent ?? "Opp").split(" ")[0];

  for (let inning = 1; inning <= 7; inning++) {
    // Mid-game bullpen switch in the 5th
    if (inning === 5 && !pitcherSwapped && relieverId !== starter.player_id) {
      events.push({
        game_id: game.id,
        sequence: seq++,
        event_type: "pitcher_change",
        home_score: homeScore,
        away_score: awayScore,
        inning,
        payload: { new_pitcher_id: relieverId },
        logged_by: coach.user_id,
        logged_by_side: "home",
      });
      pitcherSwapped = true;
    }

    // Top half: visiting team bats. If we're home, that means opponent
    // bats vs. our pitcher. If we're away, that means we bat.
    if (isHome) {
      const res = simulateOpponentHalfInning({
        inning,
        topBottom: "top",
        startingHomeScore: homeScore,
        startingAwayScore: awayScore,
        isHomeFielding: true,
        sequenceStart: seq,
        gameId: game.id,
        coachUserId: coach.user_id,
        opponentNamePrefix,
      });
      events.push(...res.events);
      homeScore = res.homeScore;
      awayScore = res.awayScore;
      seq = res.nextSeq;
    } else {
      const res = simulateHalfInning({
        lineup,
        batterStartIdx: ourBatterIdx,
        inning,
        topBottom: "top",
        startingHomeScore: homeScore,
        startingAwayScore: awayScore,
        isHomeBatting: false,
        sequenceStart: seq,
        gameId: game.id,
        coachUserId: coach.user_id,
      });
      events.push(...res.events);
      ourBatterIdx = res.batterIdx;
      homeScore = res.homeScore;
      awayScore = res.awayScore;
      seq = res.nextSeq;
    }

    // Bottom half: home team bats. Reverse attribution from top half.
    if (isHome) {
      const res = simulateHalfInning({
        lineup,
        batterStartIdx: ourBatterIdx,
        inning,
        topBottom: "bottom",
        startingHomeScore: homeScore,
        startingAwayScore: awayScore,
        isHomeBatting: true,
        sequenceStart: seq,
        gameId: game.id,
        coachUserId: coach.user_id,
      });
      events.push(...res.events);
      ourBatterIdx = res.batterIdx;
      homeScore = res.homeScore;
      awayScore = res.awayScore;
      seq = res.nextSeq;
    } else {
      const res = simulateOpponentHalfInning({
        inning,
        topBottom: "bottom",
        startingHomeScore: homeScore,
        startingAwayScore: awayScore,
        isHomeFielding: false,
        sequenceStart: seq,
        gameId: game.id,
        coachUserId: coach.user_id,
        opponentNamePrefix,
      });
      events.push(...res.events);
      homeScore = res.homeScore;
      awayScore = res.awayScore;
      seq = res.nextSeq;
    }
  }

  // End event (unless live)
  if (!isLive) {
    events.push({
      game_id: game.id,
      sequence: seq++,
      event_type: "game_end",
      home_score: homeScore,
      away_score: awayScore,
      payload: {},
      logged_by: coach.user_id,
      logged_by_side: "home",
      created_at: new Date(baseTime + 150 * 60 * 1000).toISOString(),
    });
  }

  // Spread event timestamps across the simulated game duration
  const baseDate = baseTime;
  events.forEach((e, i) => {
    if (!e.created_at) {
      e.created_at = new Date(baseDate + i * 90 * 1000).toISOString();
    }
  });

  // Batch insert events
  const CHUNK = 100;
  for (let i = 0; i < events.length; i += CHUNK) {
    const chunk = events.slice(i, i + CHUNK);
    const { error } = await svc.from("game_events").insert(chunk);
    if (error) throw new Error(`event insert failed: ${error.message}`);
  }

  // Update games row
  const ourScore = isHome ? homeScore : awayScore;
  const theirScore = isHome ? awayScore : homeScore;
  await svc
    .from("games")
    .update({
      our_score: ourScore,
      opponent_score: theirScore,
      live_status: isLive ? "in_progress" : "final",
      live_started_at: new Date(baseTime).toISOString(),
      completed_at: isLive ? null : new Date(baseTime + 150 * 60 * 1000).toISOString(),
      completed_by: isLive ? null : coach.id,
      status: isLive ? "scheduled" : "completed",
      recap_notes: isLive
        ? null
        : theirScore > ourScore
          ? "Tough loss — we fought back late but couldn't finish it."
          : ourScore > theirScore
            ? `Solid win. Bats came alive in the middle innings.`
            : "Tie held through 7. Rain shortened.",
    })
    .eq("id", game.id);

  return { events: events.length, ourScore, theirScore };
}

async function main() {
  console.log("━━━ Seeding live + historical games ━━━\n");

  const { data: coach } = await svc
    .from("coaches")
    .select("id, user_id, program_id, full_name")
    .eq("email", "coach@rostr.test")
    .maybeSingle();
  if (!coach) throw new Error("coach@rostr.test not found");

  // Seed 1 LIVE game (next scheduled varsity)
  const { data: liveGame } = await svc
    .from("games")
    .select("id, opponent, home_away, team_level, game_date")
    .eq("program_id", coach.program_id)
    .eq("status", "scheduled")
    .eq("team_level", "Varsity")
    .order("game_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (liveGame) {
    console.log(`→ Simulating LIVE varsity game vs ${liveGame.opponent}…`);
    const res = await simulateFullGame({
      game: liveGame,
      coach,
      isLive: true,
      backdateDaysAgo: null,
    });
    // Reset some events so there's still "game to play"
    // Keep only first 3 innings
    await svc
      .from("game_events")
      .delete()
      .eq("game_id", liveGame.id)
      .gt("inning", 3);
    // Revert score on games row to match truncated events
    const { data: lastEvent } = await svc
      .from("game_events")
      .select("home_score, away_score")
      .eq("game_id", liveGame.id)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastEvent) {
      const truncOurScore = liveGame.home_away === "home" ? lastEvent.home_score : lastEvent.away_score;
      const truncTheirScore = liveGame.home_away === "home" ? lastEvent.away_score : lastEvent.home_score;
      await svc.from("games").update({
        our_score: truncOurScore,
        opponent_score: truncTheirScore,
      }).eq("id", liveGame.id);
    }
    console.log(`  ✓ Live game seeded (~3 innings in)`);
    console.log(`    /g/${liveGame.id}`);
    console.log(`    /app/games/${liveGame.id}/score`);
  }

  // Seed 8 COMPLETED varsity games with full event streams for history
  console.log(`\n→ Simulating 8 past varsity games for stats history…`);
  const { data: completedGames } = await svc
    .from("games")
    .select("id, opponent, home_away, team_level, game_date")
    .eq("program_id", coach.program_id)
    .eq("status", "completed")
    .eq("team_level", "Varsity")
    .order("game_date", { ascending: false })
    .limit(8);

  let totalEvents = 0;
  for (const g of completedGames ?? []) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(g.game_date).getTime()) / 864e5,
    );
    const res = await simulateFullGame({
      game: g,
      coach,
      isLive: false,
      backdateDaysAgo: Math.max(1, daysAgo),
    });
    totalEvents += res.events;
    console.log(`  ✓ vs ${g.opponent} (${daysAgo}d ago): ${res.events} events · ${res.ourScore}-${res.theirScore}`);
  }

  console.log(`\n✅ Total ${totalEvents} events seeded across ${(completedGames ?? []).length + 1} games`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
