import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ComingSoon — stub content for routes we haven't built yet.
 * Keeps the app navigable so a coach can click through every nav link.
 */
export function ComingSoon({
  label,
  title,
  description,
  icon,
  actions,
}: {
  label: string;
  title: string;
  description: string;
  icon?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="max-w-[640px] mx-auto pt-20 pb-20 px-8 text-center">
      {icon && (
        <div
          className={cn(
            "w-16 h-16 rounded-xl bg-paper-deep text-ink-3 flex items-center justify-center mx-auto mb-6",
          )}
        >
          {icon}
        </div>
      )}
      <div className="type-label !text-red mb-2">{label}</div>
      <h1 className="font-display text-[40px] font-semibold tracking-[-0.03em] leading-[1.1]">
        {title}
      </h1>
      <p className="text-[16px] text-ink-2 mt-3 leading-relaxed max-w-[480px] mx-auto">
        {description}
      </p>
      {actions && <div className="mt-7 flex gap-2 justify-center flex-wrap">{actions}</div>}
    </div>
  );
}
