"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Modal, ModalFooter } from "@/components/molecules/modal";
import { cn } from "@/lib/utils";
import { createPlayerAction, updatePlayerAction } from "@/app/app/roster/actions";

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "UT"];

export interface PlayerEditInit {
  id: string;
  firstName: string;
  lastName: string;
  grade?: number | null;
  positions: string[];
  bats?: "L" | "R" | "S" | null;
  throws?: "L" | "R" | null;
  playerNumber?: number | null;
}

export function AddPlayerModal({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: PlayerEditInit | null;
}) {
  const router = useRouter();
  const mode = editing ? "edit" : "create";
  const [firstName, setFirstName] = useState(editing?.firstName ?? "");
  const [lastName, setLastName] = useState(editing?.lastName ?? "");
  const [grade, setGrade] = useState(editing?.grade ? String(editing.grade) : "");
  const [positions, setPositions] = useState<string[]>(editing?.positions ?? []);
  const [bats, setBats] = useState<"L" | "R" | "S" | "">(editing?.bats ?? "");
  const [throws, setThrows] = useState<"L" | "R" | "">(editing?.throws ?? "");
  const [playerNumber, setPlayerNumber] = useState(
    editing?.playerNumber != null ? String(editing.playerNumber) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setFirstName(""); setLastName(""); setGrade(""); setPositions([]);
    setBats(""); setThrows(""); setPlayerNumber(""); setError(null);
  };

  const togglePos = (p: string) => {
    setPositions((curr) => curr.includes(p) ? curr.filter((x) => x !== p) : [...curr, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = {
      firstName,
      lastName,
      grade: grade ? parseInt(grade, 10) : null,
      positions,
      bats: bats || null,
      throws: throws || null,
      playerNumber: playerNumber ? parseInt(playerNumber, 10) : null,
    };
    const result = editing
      ? await updatePlayerAction({ id: editing.id, ...payload })
      : await createPlayerAction(payload);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    toast.success(
      editing ? "Player updated" : "Player added",
      { description: `${firstName} ${lastName}` },
    );
    reset();
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
      title={mode === "edit" ? "Edit player" : "Add player"}
      description={
        mode === "edit"
          ? "Update roster info. Level assignment is managed inline from the Roster table."
          : "Quick entry — you can fill in stats, highlights, and bio later from the player's profile."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-sm bg-red-soft text-red text-[12.5px]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoFocus
              className="input-base"
              autoComplete="off"
            />
          </Field>
          <Field label="Last name">
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="input-base"
              autoComplete="off"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Jersey #">
            <input
              type="number"
              value={playerNumber}
              onChange={(e) => setPlayerNumber(e.target.value)}
              placeholder="21"
              min={0}
              className="input-base"
            />
          </Field>
          <Field label="Grade">
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="input-base"
            >
              <option value="">—</option>
              <option value="9">9 · Fr</option>
              <option value="10">10 · So</option>
              <option value="11">11 · Jr</option>
              <option value="12">12 · Sr</option>
            </select>
          </Field>
        </div>

        <Field label="Positions">
          <div className="flex flex-wrap gap-1.5">
            {POSITIONS.map((p) => {
              const active = positions.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePos(p)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xs text-[12px] font-semibold transition-colors border",
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-card text-ink-2 border-hair hover:border-ink-3",
                  )}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bats">
            <div className="flex gap-1">
              {(["L", "R", "S"] as const).map((v) => (
                <HandednessBtn key={v} value={v} current={bats} onClick={setBats} />
              ))}
            </div>
          </Field>
          <Field label="Throws">
            <div className="flex gap-1">
              {(["L", "R"] as const).map((v) => (
                <HandednessBtn key={v} value={v} current={throws} onClick={setThrows} />
              ))}
            </div>
          </Field>
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
            type="submit"
            disabled={loading}
            className="px-4 h-[38px] rounded-sm bg-red hover:bg-red/90 text-white text-[13px] font-semibold disabled:opacity-60"
          >
            {loading ? (mode === "edit" ? "Saving…" : "Adding…") : mode === "edit" ? "Save changes" : "Add player"}
          </button>
        </ModalFooter>
      </form>
      <style jsx>{`
        .input-base {
          width: 100%;
          background: var(--paper);
          border: 1px solid var(--hair);
          border-radius: 7px;
          padding: 9px 11px;
          font-size: 13.5px;
          outline: none;
        }
        .input-base:focus {
          border-color: var(--red);
          box-shadow: 0 0 0 3px var(--red-soft);
        }
      `}</style>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="type-label mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function HandednessBtn<T extends string>({
  value,
  current,
  onClick,
}: {
  value: T;
  current: T | "";
  onClick: (v: T | "") => void;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onClick(active ? ("" as T | "") : value)}
      className={cn(
        "flex-1 h-[36px] rounded-xs text-[13px] font-semibold border transition-colors",
        active
          ? "bg-ink text-white border-ink"
          : "bg-card text-ink-2 border-hair hover:border-ink-3",
      )}
    >
      {value}
    </button>
  );
}
