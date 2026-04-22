import { Plus } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";

/**
 * /app — Coach Hub.
 * Stub: shell is in place. Full hub screen will be built next
 * (per handoff/designs/02_Coach_Hub.html + SCREENS.md §2).
 */
export default function HubPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Hub" }]}
        actions={[
          { kind: "icon", notification: true },
          { kind: "primary", label: "Start practice", icon: <Plus className="w-[15px] h-[15px]" /> },
        ]}
      />
      <div className="flex-1 overflow-auto px-8 pt-7 pb-12">
        <div className="max-w-layout-hub mx-auto">
          <div className="flex items-end justify-between mb-[22px]">
            <div>
              <h1 className="font-display text-display-md">Good afternoon, Coach.</h1>
              <p className="mt-1 text-ink-3 text-[14px]">
                Tuesday · Practice #12 · 3 tasks need you
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-[11px] py-1.5 bg-red-soft text-red rounded-full text-[11px] font-bold uppercase tracking-[0.04em]">
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Practice today · 3:45 PM
            </span>
          </div>

          <div className="rounded-lg border border-hair bg-card p-6">
            <p className="text-ink-3 text-[14px]">
              Hub screen content goes here in the next sprint. Shell + atoms are
              in place — open{" "}
              <a href="/dev/atoms" className="text-red hover:underline">
                /dev/atoms
              </a>{" "}
              to verify atoms render against the design tokens.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
