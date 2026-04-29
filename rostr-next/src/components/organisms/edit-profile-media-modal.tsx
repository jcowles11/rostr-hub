"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle, Image as ImageIcon, Video, GraduationCap, Megaphone } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import {
  updatePlayerProfileMediaAction,
  createPlayerAnnouncementAction,
} from "@/app/app/roster/actions";

/**
 * EditProfileMediaModal — single entry point for:
 *   1. Header photo URL
 *   2. Avatar photo URL
 *   3. Highlight video URL (YouTube / Hudl / Vimeo)
 *   4. Commitment status + school + year
 *   5. Posting a new announcement (commitment, milestone, etc.)
 *
 * Three tabs so it stays digestible. Coach or claimed-player can use it;
 * server enforces authorization.
 */
type Tab = "photos" | "commitment" | "announce";

export function EditProfileMediaModal({
  open,
  onOpenChange,
  playerId,
  playerName,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playerId: string;
  playerName: string;
  initial: {
    avatarUrl: string | null;
    headerUrl: string | null;
    highlightVideoUrl: string | null;
    commitmentStatus: "uncommitted" | "committed" | "decommitted" | "decided" | null;
    commitmentSchool: string | null;
    commitmentYear: number | null;
    commitmentNote: string | null;
  };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("photos");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Photos + video
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? "");
  const [headerUrl, setHeaderUrl] = useState(initial.headerUrl ?? "");
  const [highlightVideoUrl, setHighlightVideoUrl] = useState(initial.highlightVideoUrl ?? "");

  // Commitment
  const [commitmentStatus, setCommitmentStatus] = useState<
    "uncommitted" | "committed" | "decommitted" | "decided"
  >(initial.commitmentStatus ?? "uncommitted");
  const [commitmentSchool, setCommitmentSchool] = useState(initial.commitmentSchool ?? "");
  const [commitmentYear, setCommitmentYear] = useState(
    initial.commitmentYear ? String(initial.commitmentYear) : "",
  );
  const [commitmentNote, setCommitmentNote] = useState(initial.commitmentNote ?? "");

  // Announcement
  const [annKind, setAnnKind] = useState<
    "commitment" | "milestone" | "update" | "video" | "achievement" | "offer"
  >("update");
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annImageUrl, setAnnImageUrl] = useState("");
  const [annLinkUrl, setAnnLinkUrl] = useState("");
  const [annPinned, setAnnPinned] = useState(false);

  const savePhotos = async () => {
    setError(null);
    setSaving(true);
    const r = await updatePlayerProfileMediaAction({
      playerId,
      avatarUrl: avatarUrl.trim() || null,
      headerUrl: headerUrl.trim() || null,
      highlightVideoUrl: highlightVideoUrl.trim() || null,
    });
    setSaving(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Profile media saved");
    router.refresh();
    onOpenChange(false);
  };

  const saveCommitment = async () => {
    setError(null);
    setSaving(true);
    const r = await updatePlayerProfileMediaAction({
      playerId,
      commitmentStatus,
      commitmentSchool: commitmentSchool.trim() || null,
      commitmentYear: commitmentYear.trim() ? parseInt(commitmentYear, 10) : null,
      commitmentNote: commitmentNote.trim() || null,
    });
    setSaving(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Commitment updated");
    router.refresh();
    onOpenChange(false);
  };

  const postAnnouncement = async () => {
    setError(null);
    if (!annTitle.trim()) {
      setError("Title required.");
      return;
    }
    setSaving(true);
    const r = await createPlayerAnnouncementAction({
      playerId,
      kind: annKind,
      title: annTitle.trim(),
      body: annBody.trim() || null,
      imageUrl: annImageUrl.trim() || null,
      linkUrl: annLinkUrl.trim() || null,
      pinned: annPinned,
    });
    setSaving(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    toast.success("Posted to feed");
    router.refresh();
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${playerName}'s profile`}
      description="Update profile photos, commitment, or post to the announcement feed."
      size="lg"
    >
      <div className="flex gap-1 bg-paper rounded-md p-1 mb-4">
        <TabButton active={tab === "photos"} onClick={() => setTab("photos")}>
          <ImageIcon className="w-3.5 h-3.5 mr-1.5 inline-block" /> Photos + video
        </TabButton>
        <TabButton active={tab === "commitment"} onClick={() => setTab("commitment")}>
          <GraduationCap className="w-3.5 h-3.5 mr-1.5 inline-block" /> Commitment
        </TabButton>
        <TabButton active={tab === "announce"} onClick={() => setTab("announce")}>
          <Megaphone className="w-3.5 h-3.5 mr-1.5 inline-block" /> Post update
        </TabButton>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {tab === "photos" && (
        <div className="space-y-4">
          <div>
            <label className="type-label mb-1.5 block">
              <ImageIcon className="w-3.5 h-3.5 inline-block mr-1" />
              Avatar photo URL
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://... (Google Drive, Dropbox, S3, imgur)"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            {avatarUrl && (
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="w-20 h-20 rounded-md bg-ink"
                  style={{
                    backgroundImage: `url("${avatarUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <span className="text-[11.5px] text-ink-3">Preview</span>
              </div>
            )}
          </div>

          <div>
            <label className="type-label mb-1.5 block">
              <ImageIcon className="w-3.5 h-3.5 inline-block mr-1" />
              Header / cover photo URL
            </label>
            <input
              type="url"
              value={headerUrl}
              onChange={(e) => setHeaderUrl(e.target.value)}
              placeholder="https://... (wide landscape image — game action, field shot)"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            {headerUrl && (
              <div className="mt-2">
                <div
                  className="w-full h-28 rounded-md bg-ink"
                  style={{
                    backgroundImage: `url("${headerUrl}")`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="type-label mb-1.5 block">
              <Video className="w-3.5 h-3.5 inline-block mr-1" />
              Highlight video URL
            </label>
            <input
              type="url"
              value={highlightVideoUrl}
              onChange={(e) => setHighlightVideoUrl(e.target.value)}
              placeholder="YouTube, Hudl, or Vimeo URL"
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
            />
            <p className="text-[10.5px] text-ink-3 mt-1">
              Paste any YouTube / Hudl / Vimeo URL — we&apos;ll embed it as a player on the profile.
            </p>
          </div>

          <ModalFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={savePhotos}
              disabled={saving}
              className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </ModalFooter>
        </div>
      )}

      {tab === "commitment" && (
        <div className="space-y-4">
          <div>
            <label className="type-label mb-1.5 block">Status</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: "uncommitted", label: "Uncommitted" },
                { value: "committed", label: "Committed" },
                { value: "decommitted", label: "Decommitted" },
                { value: "decided", label: "Decided (non-college)" },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setCommitmentStatus(s.value as typeof commitmentStatus)}
                  className={
                    "px-2 py-2 rounded-sm border text-center text-[12px] font-semibold transition-all " +
                    (commitmentStatus === s.value
                      ? "border-red bg-red-soft shadow-[0_0_0_3px_var(--red-soft)]"
                      : "border-hair bg-card text-ink-2 hover:border-ink-3")
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {commitmentStatus !== "uncommitted" && (
            <>
              <div>
                <label className="type-label mb-1.5 block">
                  {commitmentStatus === "decided" ? "Next stop" : "School"}
                </label>
                <input
                  type="text"
                  value={commitmentSchool}
                  onChange={(e) => setCommitmentSchool(e.target.value)}
                  placeholder={commitmentStatus === "decided" ? "e.g. US Army" : "e.g. Stanford"}
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
                />
              </div>
              <div>
                <label className="type-label mb-1.5 block">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2035}
                  value={commitmentYear}
                  onChange={(e) => setCommitmentYear(e.target.value)}
                  placeholder="2026"
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] font-mono outline-none focus:border-red"
                />
              </div>
              <div>
                <label className="type-label mb-1.5 block">Note (optional)</label>
                <textarea
                  value={commitmentNote}
                  onChange={(e) => setCommitmentNote(e.target.value)}
                  rows={2}
                  placeholder="Scholarship, walk-on, specific program..."
                  className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red resize-none"
                />
              </div>
            </>
          )}

          <ModalFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveCommitment}
              disabled={saving}
              className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save commitment"}
            </button>
          </ModalFooter>
        </div>
      )}

      {tab === "announce" && (
        <div className="space-y-4">
          <div>
            <label className="type-label mb-1.5 block">Kind of post</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "commitment", label: "Commitment" },
                { value: "offer", label: "Offer" },
                { value: "milestone", label: "Milestone" },
                { value: "achievement", label: "Achievement" },
                { value: "video", label: "Video" },
                { value: "update", label: "Update" },
              ].map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setAnnKind(k.value as typeof annKind)}
                  className={
                    "px-2 py-2 rounded-sm border text-center text-[12px] font-semibold transition-all " +
                    (annKind === k.value
                      ? "border-red bg-red-soft shadow-[0_0_0_3px_var(--red-soft)]"
                      : "border-hair bg-card text-ink-2 hover:border-ink-3")
                  }
                >
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="type-label mb-1.5 block">Title *</label>
            <input
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder={
                annKind === "commitment"
                  ? "Committed to Stanford!"
                  : annKind === "offer"
                    ? "Received offer from Rice"
                    : "Short headline"
              }
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
            />
          </div>

          <div>
            <label className="type-label mb-1.5 block">Body (optional)</label>
            <textarea
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={4}
              placeholder="More details. Thanks, reflection, what's next."
              className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="type-label mb-1.5 block">Image URL (optional)</label>
              <input
                type="url"
                value={annImageUrl}
                onChange={(e) => setAnnImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
              />
            </div>
            <div>
              <label className="type-label mb-1.5 block">Link URL (optional)</label>
              <input
                type="url"
                value={annLinkUrl}
                onChange={(e) => setAnnLinkUrl(e.target.value)}
                placeholder="https://... (Twitter, IG post, etc.)"
                className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13px] outline-none focus:border-red"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              checked={annPinned}
              onChange={(e) => setAnnPinned(e.target.checked)}
              className="w-4 h-4"
            />
            <span>📌 Pin to top of feed (great for commitment posts)</span>
          </label>

          <ModalFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 h-[38px] rounded-sm text-[13px] font-semibold text-ink-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={postAnnouncement}
              disabled={saving || !annTitle.trim()}
              className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
            >
              {saving ? "Posting…" : "Post to feed"}
            </button>
          </ModalFooter>
        </div>
      )}
    </Modal>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 px-3 py-2 rounded-sm text-[12.5px] font-semibold transition-colors " +
        (active
          ? "bg-card border border-hair text-ink"
          : "text-ink-3 hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
