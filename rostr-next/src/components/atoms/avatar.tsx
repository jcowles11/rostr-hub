import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Avatar — atoms/avatar
 * COMPONENTS.md §Atoms/<Avatar>: 5 sizes, 8 deterministic color presets.
 */
const avatarVariants = cva(
  "inline-flex items-center justify-center shrink-0 overflow-hidden text-white font-bold select-none",
  {
    variants: {
      size: {
        xs: "w-[18px] h-[18px] rounded-full text-[9px]",
        sm: "w-[22px] h-[22px] rounded-full text-[10px]",
        md: "w-[30px] h-[30px] rounded-full text-[11px]",
        lg: "w-[56px] h-[56px] rounded-full text-[18px] ring-4 ring-card shadow-elev",
        xl: "w-[128px] h-[128px] rounded-xl text-[40px] ring-[5px] ring-card shadow-elev",
      },
      color: {
        red: "bg-red",
        sky: "bg-sky",
        grass: "bg-grass",
        dirt: "bg-dirt",
        gold: "bg-gold",
        amber: "bg-amber",
        ink: "bg-ink",
        ink2: "bg-ink-2",
      },
    },
    defaultVariants: {
      size: "md",
      color: "dirt",
    },
  },
);

export type AvatarColor = NonNullable<
  VariantProps<typeof avatarVariants>["color"]
>;

const AVATAR_COLORS: AvatarColor[] = [
  "red",
  "sky",
  "grass",
  "dirt",
  "gold",
  "amber",
  "ink",
  "ink2",
];

/** Deterministic color pick from a stable seed (e.g. player.id). */
export function avatarColorFromSeed(seed: string): AvatarColor {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof avatarVariants> {
  /** Two-letter initials (auto-uppercased). */
  initials: string;
  src?: string;
  alt?: string;
}

export function Avatar({
  className,
  size,
  color,
  initials,
  src,
  alt,
  ...props
}: AvatarProps) {
  return (
    <span
      className={cn(avatarVariants({ size, color }), className)}
      aria-label={alt}
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="w-full h-full object-cover" />
      ) : (
        <span>{initials.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
