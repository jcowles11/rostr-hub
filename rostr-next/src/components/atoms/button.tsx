import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — atoms/button
 * Matches COMPONENTS.md §Atoms/<Button>: 5 variants × 3 sizes.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none",
  {
    variants: {
      variant: {
        // Ink bg, white text — "primary" that flips to red on hover
        primary:
          "bg-ink text-white hover:bg-red",
        // Red bg, white text — used for strong CTAs (e.g. Start practice)
        red: "bg-red text-white hover:bg-red/90",
        // Ghost: no bg, ink-2 text, hover → ink color
        ghost:
          "bg-transparent text-ink-2 hover:text-ink hover:bg-paper",
        // Secondary: white card, hair border, ink text
        secondary:
          "bg-card border border-hair text-ink hover:bg-paper",
        // Dark-ghost: for placement on ink backgrounds
        "dark-ghost":
          "bg-white/[0.08] text-white hover:bg-white/[0.14]",
      },
      size: {
        sm: "h-[30px] px-3 text-[12.5px]",
        md: "h-[34px] px-3.5 text-[13px]",
        lg: "h-[40px] px-[18px] text-[13.5px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
