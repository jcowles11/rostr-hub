import Link from "next/link";
import {
  Settings as SettingsIcon,
  Users,
  Mail,
  Shield,
  CreditCard,
  Bell,
  Database,
  Trophy,
} from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { MOCK_TEAM, MOCK_COACH } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

/**
 * /demo/settings — read-only settings tour view.
 *
 * Built parallel to /app/settings because the real SettingsView wires
 * up program edits, coach invites, role transitions, and billing —
 * all of which are write paths that don't make sense in a demo. The
 * mirror shows the panel structure + sample data so prospects can see
 * what they'd be configuring.
 */

export const metadata = {
  title: "Settings · Demo · Rostr",
  robots: { index: false, follow: false },
};

const STAFF = [
  {
    initials: "CM",
    name: "Coach Martinez",
    role: "Head Coach",
    email: "martinez@lincolnhs.edu",
    you: true,
  },
  {
    initials: "CR",
    name: "Coach Rivera",
    role: "Assistant",
    email: "rivera@lincolnhs.edu",
  },
  {
    initials: "JM",
    name: "Jen Morales",
    role: "Assistant · pitching",
    email: "j.morales@lincolnhs.edu",
  },
  {
    initials: "TC",
    name: "Tom Caldwell",
    role: "Volunteer · stats",
    email: "tcaldwell@gmail.com",
  },
];

const PENDING_INVITES = [
  { email: "ehart@lincolnhs.edu", role: "Assistant", sentAt: "2 days ago" },
];

export default function DemoSettingsPage() {
  return (
    <>
      <TopBar
        breadcrumbs={[{ label: MOCK_TEAM.name }, { label: "Settings" }]}
      />
      <div className="flex-1 overflow-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-12">
        <div className="max-w-[800px] mx-auto">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-9 h-9 rounded-md bg-paper-deep text-ink-3 flex items-center justify-center">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-display text-[28px] sm:text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
                Settings
              </h1>
              <p className="text-[13.5px] text-ink-3 mt-0.5">
                Program info, staff, sport configuration, billing.
              </p>
            </div>
          </div>

          {/* Program */}
          <Panel
            icon={<Trophy className="w-3.5 h-3.5" />}
            title="Program"
          >
            <Field label="Program name" value={MOCK_TEAM.name} />
            <Field label="Sport" value={MOCK_TEAM.sport} />
            <Field label="Team levels" value="Varsity" />
            <Field label="Season" value={MOCK_TEAM.season} />
            <Field label="Logo" value="LH (initials placeholder)" />
          </Panel>

          {/* Staff */}
          <Panel
            icon={<Users className="w-3.5 h-3.5" />}
            title="Staff"
            sub={`${STAFF.length} coaches · ${PENDING_INVITES.length} pending invite`}
          >
            <div className="divide-y divide-hair-2 -mx-4">
              {STAFF.map((s) => (
                <div
                  key={s.email}
                  className="px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-md bg-ink text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                    {s.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px]">{s.name}</span>
                      {s.you && (
                        <span className="px-1.5 py-0.5 rounded-xs bg-red-soft text-red text-[9.5px] font-bold uppercase tracking-[0.06em]">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-ink-3 mt-0.5 font-mono truncate">
                      {s.role} · {s.email}
                    </div>
                  </div>
                </div>
              ))}
              {PENDING_INVITES.map((inv) => (
                <div
                  key={inv.email}
                  className="px-4 py-3 flex items-center gap-3 bg-amber-soft/30"
                >
                  <div className="w-8 h-8 rounded-md bg-amber-soft text-amber flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-ink-2 truncate">
                      {inv.email}
                    </div>
                    <div className="text-[12px] text-ink-3 mt-0.5 font-mono">
                      {inv.role} · invite sent {inv.sentAt}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-amber uppercase tracking-[0.06em]">
                    Pending
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                href="/signup"
                className="text-[12.5px] font-semibold text-red hover:underline"
              >
                Invite a coach →
              </Link>
            </div>
          </Panel>

          {/* Notifications */}
          <Panel
            icon={<Bell className="w-3.5 h-3.5" />}
            title="Notifications"
          >
            <ToggleField label="New parent message" on />
            <ToggleField label="Recruiter outreach to a player on your roster" on />
            <ToggleField label="Stats import complete" on />
            <ToggleField label="Player marked themselves as out" on />
            <ToggleField label="Daily standup digest at 6am" on={false} />
          </Panel>

          {/* Data */}
          <Panel
            icon={<Database className="w-3.5 h-3.5" />}
            title="Data"
          >
            <ActionRow label="Import roster from GameChanger" cta="Open importer" />
            <ActionRow label="Import season stats from GameChanger" cta="Open importer" />
            <ActionRow label="Export full season report" cta="Download PDF" />
            <ActionRow
              label="Wipe demo / sample data"
              cta="Clear"
              destructive
            />
          </Panel>

          {/* Billing */}
          <Panel
            icon={<CreditCard className="w-3.5 h-3.5" />}
            title="Billing"
          >
            <Field label="Plan" value="Pilot · free" />
            <Field label="Payment method" value="—" />
            <Field label="Renews" value="—" />
            <div className="mt-3 px-4 py-3 bg-paper-deep border border-dashed border-hair rounded-md text-[12.5px] text-ink-3 leading-relaxed">
              You&apos;re on the early-access pilot. Pricing locks in
              when you upgrade — pilots keep their original rate forever.
            </div>
          </Panel>

          {/* Account */}
          <Panel
            icon={<Shield className="w-3.5 h-3.5" />}
            title="Account"
          >
            <Field label="Name" value={MOCK_COACH.name} />
            <Field label="Email" value="martinez@lincolnhs.edu" />
            <Field label="Password" value="•••••••••••" />
            <Field label="Two-factor auth" value="Enabled · Authenticator" />
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5 bg-card border border-hair rounded-lg p-5">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-hair-2">
        <span className="text-ink-3">{icon}</span>
        <h3 className="font-display text-[15.5px] font-semibold tracking-tight">
          {title}
        </h3>
        {sub && (
          <span className="text-[11.5px] text-ink-3 ml-2">{sub}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[13px]">
      <span className="text-ink-3 font-medium">{label}</span>
      <span className="font-semibold text-ink-2">{value}</span>
    </div>
  );
}

function ToggleField({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <span
        className={cn(
          "w-9 h-5 rounded-full relative transition-colors",
          on ? "bg-grass" : "bg-paper-deep border border-hair",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </div>
  );
}

function ActionRow({
  label,
  cta,
  destructive,
}: {
  label: string;
  cta: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 text-[13px]">
      <span className="text-ink-2">{label}</span>
      <button
        className={cn(
          "text-[12.5px] font-semibold hover:underline",
          destructive ? "text-red" : "text-ink-2",
        )}
      >
        {cta} →
      </button>
    </div>
  );
}
