"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RowAction {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  icon?: React.ReactNode;
}

/**
 * RowActions — a `...` trigger that opens a popover of row-scoped
 * actions. Used in roster, games list, etc.
 */
export function RowActions({ items }: { items: RowAction[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label="Row actions"
          className="text-ink-3 hover:text-ink hover:bg-paper-deep rounded-xs p-1"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          onClick={(e) => e.stopPropagation()}
          className="z-[110] bg-card border border-hair rounded-md shadow-modal min-w-[160px] py-1"
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "w-full px-3 py-2 text-left text-[13px] font-medium flex items-center gap-2.5 transition-colors",
                item.danger
                  ? "text-red hover:bg-red-soft"
                  : "hover:bg-paper text-ink-2 hover:text-ink",
              )}
            >
              {item.icon && <span className="w-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
