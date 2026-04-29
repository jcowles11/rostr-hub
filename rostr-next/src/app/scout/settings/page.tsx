import { redirect } from "next/navigation";
import { Settings as SettingsIcon } from "lucide-react";
import { getCurrentRecruiter } from "@/lib/services/recruiter";

export default async function ScoutSettingsPage() {
  const recruiter = await getCurrentRecruiter();
  if (!recruiter) redirect("/scout/setup");

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-layout-hub mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="font-display text-[24px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
          Recruiter settings
        </h1>
        <p className="text-[13.5px] text-ink-3 mt-1 mb-6">
          Your identity and organization. Verification unlocks athlete outreach.
        </p>

        <div className="bg-card border border-hair rounded-lg p-6 max-w-[560px]">
          <div className="flex items-start gap-3 mb-5">
            <SettingsIcon className="w-5 h-5 text-ink-3 mt-0.5" />
            <div className="flex-1">
              <div className="font-display text-[15px] font-semibold tracking-tight">
                Profile
              </div>
              <div className="text-[12px] text-ink-3">
                Editable from the full settings page (coming next).
              </div>
            </div>
          </div>

          <div className="space-y-3 text-[13px]">
            <KV label="Name" v={recruiter.fullName} />
            <KV label="Organization" v={recruiter.organizationName} />
            <KV label="Division" v={(recruiter.organizationDivision ?? "—").toUpperCase()} />
            <KV label="Title" v={recruiter.title ?? "—"} />
            <KV label="Sport" v={recruiter.sport} />
            {recruiter.region && <KV label="Region" v={recruiter.region} />}
            <KV label="Contact" v={recruiter.contactEmail ?? "—"} mono />
            <KV
              label="Verified"
              v={recruiter.verified ? "✓ yes" : "pending"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ label, v, mono }: { label: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-hair-2 last:border-b-0">
      <span className="type-label w-[90px] shrink-0">{label}</span>
      <span className={mono ? "font-mono text-[12.5px]" : "font-semibold"}>{v}</span>
    </div>
  );
}
