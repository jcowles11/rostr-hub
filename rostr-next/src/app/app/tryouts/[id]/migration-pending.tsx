import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * MigrationPending — shown when the tryouts tables haven't been
 * applied yet. Tells the coach exactly what to do and keeps the rest
 * of the app functional.
 */
export function MigrationPending() {
  return (
    <div className="flex-1 overflow-auto px-4 sm:px-8 py-10">
      <div className="max-w-[560px] mx-auto bg-card border border-hair rounded-lg p-7">
        <div className="w-11 h-11 rounded-full bg-amber-soft text-amber inline-flex items-center justify-center mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight">
          Tryouts tables not set up yet
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-2 leading-relaxed">
          The tryouts module needs a one-time database migration before you can
          create or run tryouts. Apply <code className="font-mono text-[12px] px-1.5 py-0.5 bg-paper rounded-xs">supabase/migrations/20260315000008_tryouts.sql</code> in your
          Supabase dashboard (SQL editor) or via the CLI, then reload this page.
        </p>
        <div className="mt-5 flex gap-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-ink hover:bg-red text-white rounded-sm text-[12.5px] font-semibold"
          >
            ← Back to Hub
          </Link>
          <Link
            href="/app/tryouts"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-paper hover:bg-paper-deep text-ink-2 rounded-sm text-[12.5px] font-semibold"
          >
            Tryouts list
          </Link>
        </div>
      </div>
    </div>
  );
}
