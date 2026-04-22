"use client";

import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LevelPill, shortCodeFor } from "@/components/atoms/level-pill";
import { setPlayerLevelAction } from "@/app/app/roster/actions";
import type { RosterLevel } from "@/lib/mock-data";

/**
 * LevelPicker — inline roster-level editor, dynamic levels edition.
 *
 * Reads the coach's configured levels (e.g. ["Varsity", "JV",
 * "Freshman", "Sophomore"]) via ProgramLevelsContext and renders a
 * picker over all of them + Cut + Unassigned. Stores the selection in
 * roster_assignments. The DB enum is constrained to varsity/jv/freshman/cut;
 * custom names beyond those map to the closest enum slot by index
 * (0 → varsity, 1 → jv, 2+ → freshman). Noted as a known issue until a
 * schema migration lifts the enum.
 */

function mapLevelToEnum(
  levelName: string,
  configuredLevels: string[],
): "varsity" | "jv" | "freshman" | "cut" | null {
  const lower = levelName.toLowerCase();
  if (lower === "cut") return "cut";
  if (lower === "unassigned" || lower === "none") return null;

  // Match by exact position in configured levels
  const idx = configuredLevels.findIndex((l) => l.toLowerCase() === lower);
  if (idx === 0) return "varsity";
  if (idx === 1) return "jv";
  if (idx >= 2) return "freshman";

  // Fallback: match by name directly
  if (lower === "varsity") return "varsity";
  if (lower === "jv" || lower === "junior varsity") return "jv";
  if (lower === "freshman" || lower === "frosh" || lower === "sophomore") return "freshman";
  return null;
}

/** Map the stored DB enum back to the configured level name for display. */
export function enumToLevelName(
  assignment: string | null | undefined,
  configuredLevels: string[],
): string {
  if (!assignment) return "Unassigned";
  const lower = assignment.toLowerCase();
  if (lower === "cut") return "Cut";
  if (lower === "varsity") return configuredLevels[0] ?? "Varsity";
  if (lower === "jv") return configuredLevels[1] ?? "JV";
  if (lower === "freshman") return configuredLevels[2] ?? "Freshman";
  return "Unassigned";
}

export function LevelPicker({
  playerId,
  playerName,
  level,
  levels,
  editable = true,
}: {
  playerId: string;
  playerName: string;
  /** Current display-level name from configured levels, or "Cut" / "Unassigned". */
  level: string;
  /** Configured levels from programs.levels (e.g. ["Varsity", "JV", "Freshman", "Sophomore"]). */
  levels: string[];
  editable?: boolean;
}) {
  const [current, setCurrent] = useState<string>(level);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const options = [
    ...levels.map((l, i) => ({ label: l, orderIndex: i })),
    { label: "Cut", orderIndex: undefined as number | undefined },
    { label: "Unassigned", orderIndex: undefined },
  ];

  const orderIndex = levels.findIndex((l) => l.toLowerCase() === current.toLowerCase());

  if (!editable) {
    return <LevelPill level={current} orderIndex={orderIndex >= 0 ? orderIndex : undefined} />;
  }

  const handleSelect = (name: string) => {
    const prev = current;
    setCurrent(name);
    setOpen(false);
    startTransition(async () => {
      const dbValue = mapLevelToEnum(name, levels);
      const result = await setPlayerLevelAction(playerId, dbValue);
      if (result.error) {
        setCurrent(prev);
        toast.error("Couldn't move player", { description: result.error });
      } else {
        toast.success(`${playerName} → ${name}`);
      }
    });
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-xs px-0.5 py-0.5 hover:bg-paper-deep transition-colors"
        >
          <LevelPill
            level={current}
            orderIndex={orderIndex >= 0 ? orderIndex : undefined}
          />
          <ChevronDown className="w-3 h-3 text-ink-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[200px] py-1"
        >
          {options.map((opt) => {
            const active = opt.label.toLowerCase() === current.toLowerCase();
            return (
              <button
                key={opt.label}
                onClick={() => handleSelect(opt.label)}
                className={cn(
                  "w-full px-3 py-2 text-left text-[13px] font-medium hover:bg-paper flex items-center gap-2.5",
                  active && "bg-paper text-ink font-semibold",
                )}
              >
                <span className="w-3.5">{active && <Check className="w-3.5 h-3.5 text-red" />}</span>
                <LevelPill
                  level={opt.label}
                  orderIndex={opt.orderIndex}
                  className="mr-1"
                />
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// kept for backwards compat (original hardcoded variant)
export type Level = RosterLevel;
