"use client";

import { useState } from "react";
import { notFound } from "next/navigation";
import { Plus, Download, ArrowRight } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Badge } from "@/components/atoms/badge";
import { LevelPill } from "@/components/atoms/level-pill";
import { Avatar, avatarColorFromSeed } from "@/components/atoms/avatar";
import { Input, SearchInput } from "@/components/atoms/input";
import { Kbd } from "@/components/atoms/kbd";
import { Toggle } from "@/components/atoms/toggle";
import { Checkbox } from "@/components/atoms/checkbox";
import { Chip } from "@/components/atoms/chip";

/**
 * /dev/atoms — developer-only showcase page.
 * Every atom rendered in every variant so we can visually verify
 * against the tokens + COMPONENTS.md before moving on to screens.
 *
 * Production gate: this page is fine in dev but doesn't belong on the
 * public site. We 404 it in production so a curious visitor can't
 * stumble onto an internal-looking page. To preview in production,
 * set NEXT_PUBLIC_ENABLE_DEV_PAGES=1 at build time.
 */
export default function AtomsPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_PAGES !== "1"
  ) {
    notFound();
  }
  const [toggleOn, setToggleOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [chipOn, setChipOn] = useState(false);
  const [removedChips, setRemovedChips] = useState<string[]>([]);

  return (
    <div className="mx-auto max-w-4xl p-10 space-y-12">
      <header>
        <p className="type-label">Dev reference</p>
        <h1 className="font-display text-display-lg mt-1">Atoms</h1>
        <p className="text-ink-3 mt-1">
          Every atomic component from COMPONENTS.md, rendered against the design tokens.
        </p>
      </header>

      <Section title="Button">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="red">Red</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="secondary">Secondary</Button>
          <div className="bg-ink p-2 rounded-sm">
            <Button variant="dark-ghost">Dark Ghost</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="md" variant="primary">
            <Plus className="w-[15px] h-[15px]" />
            With icon
          </Button>
          <Button size="md" variant="secondary">
            <Download className="w-[15px] h-[15px]" />
            Import
          </Button>
        </div>
      </Section>

      <Section title="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge variant="live">Live</Badge>
          <Badge variant="keep">Keep</Badge>
          <Badge variant="bubble">Bubble</Badge>
          <Badge variant="cut">Cut</Badge>
          <Badge variant="undecided">Undecided</Badge>
          <Badge variant="linked">Linked</Badge>
          <Badge variant="pending">Pending</Badge>
          <Badge variant="unlinked">Unlinked</Badge>
          <Badge variant="verified">Verified</Badge>
          <Badge variant="ai">AI Assistant Coach</Badge>
        </div>
      </Section>

      <Section title="LevelPill">
        <div className="flex gap-2">
          <LevelPill level="Varsity" orderIndex={0} />
          <LevelPill level="JV" orderIndex={1} />
          <LevelPill level="Freshman" orderIndex={2} />
          <LevelPill level="Sophomore" orderIndex={3} />
          <LevelPill level="Cut" />
          <LevelPill level="Unassigned" />
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex items-end gap-4">
          <Avatar size="xs" initials="AB" color="red" />
          <Avatar size="sm" initials="CD" color="sky" />
          <Avatar size="md" initials="EF" color="grass" />
          <Avatar size="lg" initials="GH" color="dirt" />
          <Avatar size="xl" initials="JC" color="gold" />
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {["red", "sky", "grass", "dirt", "gold", "amber", "ink", "ink2"].map((c) => (
            <Avatar key={c} size="md" initials={c.slice(0, 2)} color={c as never} />
          ))}
        </div>
        <p className="text-caption text-ink-3 mt-3">
          Deterministic: <span className="font-mono">avatarColorFromSeed(&quot;player-42&quot;)</span> ={" "}
          <span className="font-mono">{avatarColorFromSeed("player-42")}</span>
        </p>
      </Section>

      <Section title="Input">
        <div className="max-w-sm space-y-2">
          <Input placeholder="Plain input…" />
          <SearchInput />
          <SearchInput placeholder="Search players, drills, games…" showShortcut={false} />
        </div>
      </Section>

      <Section title="Kbd">
        <div className="flex items-center gap-2">
          <Kbd>⌘K</Kbd>
          <Kbd>⌘⏎</Kbd>
          <Kbd>?</Kbd>
          <span className="text-caption text-ink-3">
            Press <Kbd>g</Kbd> <Kbd>h</Kbd> to go home.
          </span>
        </div>
      </Section>

      <Section title="Toggle">
        <div className="flex items-center gap-3">
          <Toggle on={toggleOn} onChange={setToggleOn} aria-label="Sample toggle" />
          <span className="text-caption text-ink-3">{toggleOn ? "On" : "Off"}</span>
        </div>
      </Section>

      <Section title="Checkbox">
        <div className="flex items-center gap-3">
          <Checkbox checked={checked} onChange={setChecked} aria-label="Sample checkbox" />
          <Checkbox checked={false} disabled aria-label="Disabled" />
          <span className="text-caption text-ink-3">
            {checked ? "Checked" : "Unchecked"}
          </span>
        </div>
      </Section>

      <Section title="Chip">
        <div className="flex flex-wrap gap-2">
          <Chip on={chipOn} onClick={() => setChipOn((v) => !v)}>
            Toggleable chip
          </Chip>
          {!removedChips.includes("a") && (
            <Chip removable onRemove={() => setRemovedChips((r) => [...r, "a"])}>
              Removable chip
            </Chip>
          )}
          {!removedChips.includes("b") && (
            <Chip on removable onRemove={() => setRemovedChips((r) => [...r, "b"])}>
              On + removable
            </Chip>
          )}
          <Chip>
            Static <ArrowRight className="w-3 h-3" />
          </Chip>
        </div>
      </Section>

      <Section title="Typography scale">
        <div className="space-y-3">
          <div className="font-display text-display-xl">Display XL 72px</div>
          <div className="font-display text-display-lg">Display LG 46px</div>
          <div className="font-display text-display-md">Display MD 32px</div>
          <div className="font-display text-display-sm">Display SM 22px</div>
          <div className="text-h1 font-display">Heading H1</div>
          <div className="text-h2 font-display">Heading H2</div>
          <div className="text-h3 font-display">Heading H3</div>
          <div className="text-body">Body 14px — the default UI paragraph</div>
          <div className="text-body-sm text-ink-3">Body SM 13px · muted</div>
          <div className="text-caption text-ink-3">Caption 12px</div>
          <div className="type-label">Label 11px uppercase</div>
          <div className="font-mono text-stat-xl">42.50</div>
          <div className="font-mono text-stat-md">18:30</div>
          <div className="font-mono text-stat-sm">6/10</div>
        </div>
      </Section>

      <Section title="Palette swatches">
        <div className="grid grid-cols-5 gap-2 text-[10.5px] font-mono">
          {[
            ["paper", "--paper"],
            ["paper-deep", "--paper-deep"],
            ["card", "--card"],
            ["ink", "--ink"],
            ["ink-2", "--ink-2"],
            ["ink-3", "--ink-3"],
            ["ink-4", "--ink-4"],
            ["hair", "--hair"],
            ["hair-2", "--hair-2"],
            ["red", "--red"],
            ["red-soft", "--red-soft"],
            ["red-dim", "--red-dim"],
            ["grass", "--grass"],
            ["grass-dim", "--grass-dim"],
            ["dirt", "--dirt"],
            ["sky", "--sky"],
            ["sky-soft", "--sky-soft"],
            ["gold", "--gold"],
            ["amber", "--amber"],
            ["amber-soft", "--amber-soft"],
          ].map(([name, token]) => (
            <div key={name} className="border border-hair rounded-sm overflow-hidden">
              <div
                className="h-12 border-b border-hair"
                style={{ background: `var(${token})` }}
              />
              <div className="p-1.5 bg-card">
                <div className="font-semibold">{name}</div>
                <div className="text-ink-4">{token}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="type-label mb-3">{title}</div>
      <div className="p-4 bg-card border border-hair rounded-md">{children}</div>
    </section>
  );
}
