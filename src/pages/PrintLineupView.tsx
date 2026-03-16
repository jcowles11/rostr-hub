/**
 * PrintLineupView — Print-optimized lineup card page.
 *
 * Displays 4 identical lineup cards in a 2×2 grid on a single page,
 * optimized for cutting with scissors. Includes coach-configurable
 * options for name display and position format.
 *
 * Route: /game/:id/print-lineup
 * Data: fetches game, lineup_entries, and players (read-only)
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchLineup, type Game } from "@/services/teamService";
import LineupCard, {
  positionToNumber,
  positionToAbbrev,
  type LineupCardPlayer,
} from "@/components/LineupCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────

type NameFormat = "full" | "last";
type PosFormat = "abbrev" | "number";

interface Player {
  id: string;
  first_name: string;
  last_name: string;
  player_number: number | null;
}

// ── Component ──────────────────────────────────────────────────────

export default function PrintLineupView() {
  const { id: gameId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { coach } = useAuth();

  // Data
  const [game, setGame] = useState<Game | null>(null);
  const [players, setPlayers] = useState<Map<string, Player>>(new Map());
  const [lineupRaw, setLineupRaw] = useState<
    Array<{ player_id: string; batting_order: number | null; position: string | null }>
  >([]);
  const [loading, setLoading] = useState(true);

  // Options
  const [nameFormat, setNameFormat] = useState<NameFormat>("full");
  const [posFormat, setPosFormat] = useState<PosFormat>("abbrev");

  // ── Fetch ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!coach || !gameId) return;
    setLoading(true);

    const [gRes, pRes, lRes] = await Promise.all([
      supabase
        .from("games")
        .select(
          "id, program_id, season_id, name, opponent, team_level, game_date, game_time, location, notes, status, created_by, created_at"
        )
        .eq("id", gameId)
        .single(),
      supabase
        .from("players")
        .select("id, first_name, last_name, player_number")
        .eq("program_id", coach.program_id),
      fetchLineup(gameId),
    ]);

    if (gRes.data) setGame(gRes.data as Game);

    const pMap = new Map<string, Player>();
    (pRes.data || []).forEach((p: Player) => pMap.set(p.id, p));
    setPlayers(pMap);

    setLineupRaw(
      lRes.data.map((e) => ({
        player_id: e.player_id,
        batting_order: e.batting_order,
        position: e.position,
      }))
    );

    setLoading(false);
  }, [coach, gameId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────

  const programName = coach?.program_name || "Team";

  const formattedDate = useMemo(() => {
    if (!game) return "";
    return format(new Date(game.game_date + "T00:00:00"), "MMM d, yyyy");
  }, [game]);

  const cardPlayers: LineupCardPlayer[] = useMemo(() => {
    return lineupRaw
      .sort((a, b) => (a.batting_order ?? 99) - (b.batting_order ?? 99))
      .map((entry) => {
        const p = players.get(entry.player_id);
        if (!p) {
          return {
            battingOrder: entry.batting_order ?? 0,
            name: "Unknown",
            jerseyNumber: null,
            position: entry.position || "",
          };
        }

        const name =
          nameFormat === "last"
            ? p.last_name
            : `${p.first_name} ${p.last_name}`;

        const position = entry.position
          ? posFormat === "number"
            ? positionToNumber(entry.position)
            : positionToAbbrev(entry.position)
          : "";

        return {
          battingOrder: entry.batting_order ?? 0,
          name,
          jerseyNumber: p.player_number,
          position,
        };
      });
  }, [lineupRaw, players, nameFormat, posFormat]);

  // ── Handlers ───────────────────────────────────────────────────

  const handlePrint = () => window.print();

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Loading lineup...</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 text-center">
        <p className="text-muted-foreground">Game not found.</p>
        <Button variant="ghost" onClick={() => navigate("/teams")} className="mt-4">
          Back to Teams
        </Button>
      </div>
    );
  }

  if (lineupRaw.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-4 text-center">
        <p className="text-muted-foreground">
          No lineup entries found. Build a lineup in the game detail first.
        </p>
        <Button variant="ghost" onClick={() => navigate(`/game/${gameId}`)} className="mt-4">
          Back to Game
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* ── Toolbar (hidden when printing) ─────────────────────── */}
      <div className="print-hide mx-auto max-w-2xl px-4 pt-4 pb-6 space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/game/${gameId}`)}
            className="p-2 rounded-xl hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-extrabold flex-1">Print Lineup</h1>
          <Button onClick={handlePrint} className="rounded-xl font-bold">
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
        </div>

        {/* Options */}
        <div className="flex flex-wrap gap-4">
          <fieldset className="space-y-1">
            <legend className="text-xs font-bold text-muted-foreground uppercase">
              Name Display
            </legend>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
              <button
                onClick={() => setNameFormat("full")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  nameFormat === "full"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Full Name
              </button>
              <button
                onClick={() => setNameFormat("last")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  nameFormat === "last"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                Last Only
              </button>
            </div>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="text-xs font-bold text-muted-foreground uppercase">
              Position Format
            </legend>
            <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
              <button
                onClick={() => setPosFormat("abbrev")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  posFormat === "abbrev"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                SS, CF
              </button>
              <button
                onClick={() => setPosFormat("number")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  posFormat === "number"
                    ? "bg-card shadow-sm text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                6, 8
              </button>
            </div>
          </fieldset>
        </div>

        <p className="text-xs text-muted-foreground">
          Preview below. Four identical cards will print on one page — cut along the dotted lines.
        </p>
      </div>

      {/* ── Print area: 2×2 grid ───────────────────────────────── */}
      <div className="print-area">
        <div className="lineup-grid">
          {[0, 1, 2, 3].map((i) => (
            <LineupCard
              key={i}
              teamName={programName}
              opponent={game.opponent}
              date={formattedDate}
              teamLevel={game.team_level}
              location={game.location}
              players={cardPlayers}
              variant="card"
            />
          ))}
        </div>
      </div>

      {/* ── Print-only styles ──────────────────────────────────── */}
      <style>{`
        /* ── Screen preview ────────────────────────────────── */
        .print-area {
          max-width: 800px;
          margin: 0 auto;
          padding: 0 1rem 2rem;
        }

        .lineup-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          border: 1px dashed #ccc;
        }

        /* ── Card base styles (screen + print) ─────────────── */
        .lineup-card {
          padding: 10px 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          color: #000;
          background: #fff;
          border: 1px dashed #ccc;
          box-sizing: border-box;
          overflow: hidden;
        }

        .lineup-card__header {
          border-bottom: 2px solid #000;
          padding-bottom: 4px;
          margin-bottom: 4px;
        }

        .lineup-card__team {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .lineup-card__team-name {
          font-weight: 800;
          font-size: 14px;
          line-height: 1.2;
        }

        .lineup-card__level {
          font-size: 10px;
          font-weight: 600;
          border: 1px solid #666;
          border-radius: 3px;
          padding: 0 4px;
          line-height: 1.4;
        }

        .lineup-card__opponent {
          font-weight: 700;
          font-size: 12px;
          margin-top: 1px;
        }

        .lineup-card__meta {
          font-size: 9px;
          color: #555;
          margin-top: 1px;
        }

        /* ── Table ─────────────────────────────────────────── */
        .lineup-card__table {
          width: 100%;
          border-collapse: collapse;
        }

        .lineup-card__th {
          text-align: left;
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #555;
          padding: 2px 4px;
          border-bottom: 1px solid #999;
        }

        .lineup-card__th--order { width: 20px; text-align: center; }
        .lineup-card__th--name  { }
        .lineup-card__th--number { width: 30px; text-align: center; }
        .lineup-card__th--pos   { width: 30px; text-align: center; }

        .lineup-card__td {
          padding: 2.5px 4px;
          border-bottom: 1px solid #ddd;
          font-size: 11px;
          line-height: 1.3;
        }

        .lineup-card__td--order {
          text-align: center;
          font-weight: 800;
          font-size: 12px;
          color: #333;
        }

        .lineup-card__td--name {
          font-weight: 600;
        }

        .lineup-card__td--number {
          text-align: center;
          font-size: 10px;
          color: #555;
        }

        .lineup-card__td--pos {
          text-align: center;
          font-weight: 700;
          font-size: 10px;
        }

        .lineup-card__row--empty .lineup-card__td {
          color: #bbb;
        }

        .lineup-card__row--empty .lineup-card__td--name,
        .lineup-card__row--empty .lineup-card__td--number,
        .lineup-card__row--empty .lineup-card__td--pos {
          border-bottom: 1px solid #eee;
          min-height: 16px;
        }

        /* ── Print media ───────────────────────────────────── */
        @media print {
          /* Hide everything except print area */
          .print-hide,
          nav,
          header,
          footer,
          .sonner-toaster,
          [data-radix-popper-content-wrapper] {
            display: none !important;
          }

          body {
            margin: 0;
            padding: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .print-area {
            max-width: none;
            padding: 0;
            margin: 0;
          }

          .lineup-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr 1fr;
            gap: 0;
            width: 100vw;
            height: 100vh;
            border: none;
            page-break-after: avoid;
          }

          .lineup-card {
            border: 1px dashed #aaa;
            padding: 8px 10px;
            overflow: hidden;
            height: 100%;
            box-sizing: border-box;
          }

          .lineup-card__team-name {
            font-size: 13px;
          }

          .lineup-card__opponent {
            font-size: 11px;
          }

          @page {
            size: letter portrait;
            margin: 0.25in;
          }
        }
      `}</style>
    </>
  );
}
