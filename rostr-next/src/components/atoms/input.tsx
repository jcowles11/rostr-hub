import * as React from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

/**
 * Input — atoms/input
 * COMPONENTS.md §Atoms/<Input>: paper bg, hair border, 13px text.
 * Supports leading icon and trailing content (e.g. ⌘K hint).
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, trailing, wrapperClassName, ...props }, ref) => {
    const hasDecoration = Boolean(icon || trailing);
    if (hasDecoration) {
      return (
        <div
          className={cn(
            "flex items-center gap-2 bg-paper border border-hair rounded-sm px-3 py-1.5 text-[13px] text-ink-3",
            "focus-within:border-red focus-within:ring-2 focus-within:ring-red-soft",
            wrapperClassName,
          )}
        >
          {icon && (
            <span className="shrink-0 text-ink-3 flex items-center">{icon}</span>
          )}
          <input
            ref={ref}
            className={cn(
              "flex-1 bg-transparent outline-none placeholder:text-ink-3 text-ink",
              className,
            )}
            {...props}
          />
          {trailing && <span className="shrink-0">{trailing}</span>}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        className={cn(
          "w-full bg-paper border border-hair rounded-sm px-3 py-1.5 text-[13px] text-ink placeholder:text-ink-3",
          "focus:border-red focus:outline-none focus:ring-2 focus:ring-red-soft",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

/** SearchInput — the specific variant used in TopBar and list headers. */
export interface SearchInputProps extends Omit<InputProps, "icon" | "trailing"> {
  showShortcut?: boolean;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ showShortcut = true, placeholder = "Search…", className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        type="search"
        placeholder={placeholder}
        icon={
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4.35-4.35" />
          </svg>
        }
        trailing={showShortcut ? <Kbd>⌘K</Kbd> : undefined}
        className={className}
        {...props}
      />
    );
  },
);
SearchInput.displayName = "SearchInput";
