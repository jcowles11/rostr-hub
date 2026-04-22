import { cn } from "@/lib/utils";

/**
 * FeedItem — molecules/feed-item
 * COMPONENTS.md §Molecules/<FeedItem>: icon avatar + body + time.
 * Used in the activity feed on the Coach Hub and elsewhere.
 */
export interface FeedItemProps {
  icon: React.ReactNode;
  iconColor?: "red" | "sky" | "grass" | "dirt" | "gold" | "amber" | "ink";
  children: React.ReactNode;
  meta?: string;
  className?: string;
}

const ICON_BG: Record<NonNullable<FeedItemProps["iconColor"]>, string> = {
  red: "bg-red",
  sky: "bg-sky",
  grass: "bg-grass",
  dirt: "bg-dirt",
  gold: "bg-gold",
  amber: "bg-amber",
  ink: "bg-ink",
};

export function FeedItem({
  icon,
  iconColor = "ink",
  children,
  meta,
  className,
}: FeedItemProps) {
  return (
    <div
      className={cn(
        "flex gap-3 px-[18px] py-3 border-b border-hair-2 last:border-b-0 items-start",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-full inline-flex items-center justify-center text-white text-[11px] font-bold",
          ICON_BG[iconColor],
        )}
      >
        {icon}
      </span>
      <div className="flex-1 text-[13px] leading-relaxed">
        {children}
        {meta && (
          <div className="mt-0.5 font-mono text-[11px] text-ink-3">{meta}</div>
        )}
      </div>
    </div>
  );
}
