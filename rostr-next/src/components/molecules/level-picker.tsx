"use client";

import { useState, useTransition } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LevelPill } from "@/components/atoms/level-pill";
import { setPlayerLevelAction } from "@/app/app/roster/actions";
import type { RosterLevel } from "@/lib/mock-data";

/**
 * LevelPicker — inline roster-level editor.
 * Click → popover with V / JV / Fr / Cut / Unassigned options.
 * Writes to roster_assignments on change. Optimistic UI.
 */
const OPTIONS: Array<{
  level: RosterLevel | "cut" | "unassigned";
  label: string;
  dbValue: "varsity" | "jv" | "freshman" | "cut" | null;
}> = [
  { level: "V", label: "Varsity", dbValue: "varsity" },
  { level: "JV", label: "JV", dbValue: "jv" },
  { level: "F", label: "Freshman", dbValue: "freshman" },
  { level: "cut", label: "Cut", dbValue: "cut" },
  { level: "unassigned", label: "Unassigned", dbValue: null },
];

export function LevelPicker({
  playerId,
  playerName,
  level,
  /** If false, renders a read-only pill (used in demo mode without a real coach). */
  editable = true,
}: {
  playerId: string;
  playerName: string;
  level: RosterLevel;
  editable?: boolean;
}) {
  const [current, setCurrent] = useState<RosterLevel>(level);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (!editable) {
    return <LevelPill level={current} />;
  }

  const handleSelect = (opt: (typeof OPTIONS)[number]) => {
    const nextLevel: RosterLevel =
      opt.level === "V" || opt.level === "JV" || opt.level === "F"
        ? (opt.level as RosterLevel)
        : "V"; // cut + unassigned visually collapse to "V" on the pill for now
    const prev = current;
    setCurrent(nextLevel);
    setOpen(false);
    startTransition(async () => {
      const result = await setPlayerLevelAction(playerId, opt.dbValue);
      if (result.error) {
        setCurrent(prev);
        toast.error("Couldn't move player", { description: result.error });
      } else {
        toast.success(`${playerName} → ${opt.label}`);
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
          <LevelPill level={current} />
          <ChevronDown className="w-3 h-3 text-ink-3" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[180px] py-1"
        >
          {OPTIONS.map((opt) => {
            const active =
              (opt.level === "V" && current === "V") ||
              (opt.level === "JV" && current === "JV") ||
              (opt.level === "F" && current === "F");
            return (
              <button
                key={opt.label}
                onClick={() => handleSelect(opt)}
                className={cn(
                  "w-full px-3 py-2 text-left text-[13px] font-medium hover:bg-paper flex items-center gap-2.5",
                  active && "bg-paper text-ink font-semibold",
                )}
              >
                <span className="w-3.5">{active && <Check className="w-3.5 h-3.5 text-red" />}</span>
                {opt.label}
              </button>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
