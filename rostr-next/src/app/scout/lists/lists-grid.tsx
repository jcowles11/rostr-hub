"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight } from "lucide-react";
import type { RecruiterList } from "@/lib/services/recruiter";
import { createListAction, deleteListAction } from "../actions";

const EMOJI_SUGGESTIONS = ["❤️", "🔥", "⭐", "🎯", "👀", "🏆", "💎", "🚀", "📋"];

export function ListsGrid({ lists }: { lists: RecruiterList[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("❤️");

  const submit = async () => {
    if (!name.trim()) return;
    const r = await createListAction({ name, emoji });
    if (r.error) toast.error("Couldn't create", { description: r.error });
    else {
      toast.success(`Created "${name}"`);
      setName("");
      setEmoji("❤️");
      setCreating(false);
      router.refresh();
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {lists.map((list) => (
        <ListCard key={list.id} list={list} onRefresh={() => router.refresh()} />
      ))}

      {/* New list card */}
      {creating ? (
        <div className="bg-card border-2 border-dashed border-red rounded-lg p-5">
          <div className="flex gap-1.5 flex-wrap mb-3">
            {EMOJI_SUGGESTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`w-8 h-8 rounded-sm text-[18px] hover:bg-paper ${emoji === e ? "bg-red-soft" : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") setCreating(false);
            }}
            placeholder="List name"
            className="w-full bg-paper border border-hair rounded-sm px-3 py-2 text-[13.5px] outline-none focus:border-red"
          />
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                setCreating(false);
                setName("");
              }}
              className="px-3 py-1.5 text-[12.5px] text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!name.trim()}
              className="px-3 py-1.5 bg-red text-white rounded-sm text-[12.5px] font-semibold disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="bg-card border-2 border-dashed border-hair rounded-lg p-5 text-center hover:border-ink transition-colors group min-h-[120px] flex flex-col items-center justify-center gap-1.5"
        >
          <Plus className="w-6 h-6 text-ink-3 group-hover:text-red transition-colors" />
          <span className="text-[13.5px] font-semibold text-ink-3 group-hover:text-ink">
            New list
          </span>
        </button>
      )}
    </div>
  );
}

function ListCard({
  list,
  onRefresh,
}: {
  list: RecruiterList;
  onRefresh: () => void;
}) {
  const remove = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete "${list.name}"? Players in it won't be deleted — just this list.`)) return;
    const r = await deleteListAction(list.id);
    if (r.error) toast.error("Couldn't delete", { description: r.error });
    else {
      toast.success("Deleted");
      onRefresh();
    }
  };

  return (
    <Link
      href={`/scout/lists/${list.id}`}
      className="group relative bg-card border border-hair rounded-lg p-5 hover:border-ink transition-colors flex flex-col"
    >
      <div className="flex items-start gap-3 mb-4">
        <span
          className="w-10 h-10 rounded-md flex items-center justify-center text-[20px] shrink-0"
          style={{ background: list.color ? `${list.color}22` : "#f8dedc" }}
        >
          {list.emoji ?? "•"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[16px] font-semibold tracking-tight truncate">
            {list.name}
          </div>
          <div className="font-mono text-[11px] text-ink-3 mt-0.5">
            {list.playerCount} {list.playerCount === 1 ? "player" : "players"}
          </div>
        </div>
      </div>
      {list.description && (
        <p className="text-[11.5px] text-ink-2 leading-relaxed mb-3 line-clamp-2">
          {list.description}
        </p>
      )}
      <div className="mt-auto flex items-center gap-1.5 text-[11.5px] text-red font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
        Open
        <ArrowRight className="w-3 h-3" />
      </div>
      <button
        onClick={remove}
        className="absolute top-3 right-3 p-1.5 rounded-xs text-ink-3 hover:text-red hover:bg-red-soft opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Delete list"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </Link>
  );
}
