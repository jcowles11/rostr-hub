"use client";

import { useState } from "react";
import { Bell, User, Users, Shield, Zap, Database, Link2 } from "lucide-react";
import { TopBar } from "@/components/organisms/top-bar";
import { Avatar } from "@/components/atoms/avatar";
import { Toggle } from "@/components/atoms/toggle";
import { cn } from "@/lib/utils";

/**
 * /app/settings — Coach settings stub.
 */
const SECTIONS = [
  { label: "Program", icon: <Users className="w-4 h-4" /> },
  { label: "Team defaults", icon: <User className="w-4 h-4" /> },
  { label: "Coaches", icon: <Users className="w-4 h-4" /> },
  { label: "Notifications", icon: <Bell className="w-4 h-4" /> },
  { label: "Integrations", icon: <Link2 className="w-4 h-4" /> },
  { label: "Data & privacy", icon: <Shield className="w-4 h-4" /> },
  { label: "AI Co-coach", icon: <Zap className="w-4 h-4" /> },
  { label: "Advanced", icon: <Database className="w-4 h-4" /> },
];

export default function SettingsPage() {
  const [notifications, setNotifications] = useState({
    email: true,
    sms: true,
    push: false,
    recruiter: true,
  });

  return (
    <>
      <TopBar
        breadcrumbs={[{ label: "Lincoln HS" }, { label: "Settings" }]}
        actions={[{ kind: "icon", icon: <Bell className="w-[15px] h-[15px]" /> }]}
      />
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-[240px_1fr] max-w-layout-hub mx-auto">
          <nav className="border-r border-hair py-8 px-4 space-y-0.5">
            <div className="type-label mb-3 px-2">Settings</div>
            {SECTIONS.map((s, i) => (
              <button
                key={s.label}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[13px] font-medium transition-colors",
                  i === 0 ? "bg-paper-deep text-ink" : "text-ink-2 hover:text-ink hover:bg-paper",
                )}
              >
                <span className="text-ink-3">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="px-10 py-8 max-w-[720px]">
            <h1 className="font-display text-[30px] font-semibold tracking-[-0.03em] leading-[1.1]">
              Program
            </h1>
            <p className="text-[13.5px] text-ink-3 mt-1 mb-8">
              Your team identity, logo, and program-wide defaults.
            </p>

            <div className="space-y-6">
              <Field label="Program name" value="Lincoln HS Baseball" />
              <Field label="Head coach" value="Coach Martinez" />
              <div>
                <div className="type-label mb-2">Team logo</div>
                <div className="flex items-center gap-4">
                  <Avatar size="lg" color="red" initials="LH" />
                  <button className="px-3 py-2 bg-card border border-hair rounded-sm text-[13px] font-semibold hover:border-ink">
                    Upload logo
                  </button>
                </div>
              </div>
              <Field label="Primary sport" value="Baseball" />
              <Field label="Levels" value="Varsity · JV · Freshman" />
              <Field label="Season" value="Spring 2026 · Feb 17 – Jun 1" />

              <div className="pt-4 border-t border-hair">
                <div className="type-label mb-4">Notifications</div>
                <div className="space-y-3">
                  <ToggleRow
                    label="Email digests"
                    sub="Daily summary of activity across your program"
                    value={notifications.email}
                    onChange={(v) => setNotifications({ ...notifications, email: v })}
                  />
                  <ToggleRow
                    label="SMS for urgent"
                    sub="Practice cancellations, game-day reminders"
                    value={notifications.sms}
                    onChange={(v) => setNotifications({ ...notifications, sms: v })}
                  />
                  <ToggleRow
                    label="Push notifications"
                    sub="Mobile app notifications for messages and alerts"
                    value={notifications.push}
                    onChange={(v) => setNotifications({ ...notifications, push: v })}
                  />
                  <ToggleRow
                    label="Recruiter views · weekly"
                    sub="Bundle of college coach profile views"
                    value={notifications.recruiter}
                    onChange={(v) => setNotifications({ ...notifications, recruiter: v })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-hair-2 last:border-b-0">
      <div>
        <div className="type-label">{label}</div>
        <div className="text-[14px] font-semibold mt-0.5">{value}</div>
      </div>
      <button className="text-[12px] text-ink-3 hover:text-ink font-semibold">Edit</button>
    </div>
  );
}

function ToggleRow({
  label,
  sub,
  value,
  onChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-[13.5px] font-semibold">{label}</div>
        <div className="text-[11.5px] text-ink-3 mt-0.5">{sub}</div>
      </div>
      <Toggle on={value} onChange={onChange} aria-label={label} />
    </div>
  );
}
