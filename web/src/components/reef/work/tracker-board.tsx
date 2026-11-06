"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BoardItem, MatchData } from "@/lib/match-data";
import { setStatus } from "@/components/reef/work/status-actions";

const COLUMNS: { key: keyof MatchData["board"]; label: string; note: string }[] = [
  { key: "applied", label: "Applied", note: "Waiting to hear back" },
  { key: "process", label: "In process", note: "Responded, assessment or interview" },
  { key: "offer", label: "Offer", note: "Offer or hired" },
  { key: "closed", label: "Closed", note: "Rejected in the last 30 days" },
];

// The next status a card can move to, one press each. set-status.mjs validates.
const MOVES: Record<string, string[]> = {
  Applied: ["Responded", "Interview", "Rejected"],
  Responded: ["Interview", "Rejected"],
  Assessment: ["Interview", "Rejected"],
  Interview: ["Offer", "Rejected"],
  Offer: ["Hired"],
};

function Card({ item }: { item: BoardItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const move = async (to: string) => {
    setBusy(true);
    const e = await setStatus(item.n, to);
    setBusy(false);
    setErr(e ?? "");
    if (!e) router.refresh();
  };
  return (
    <li className="lux-card gap-2 p-4">
      <span className="lux-eyebrow">{item.company}</span>
      <span className="lux-serif text-[1.1rem] leading-tight">{item.role}</span>
      <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--lux-mute)]">
        <span className="lux-tag">{item.status}</span>
        <span className="tabular-nums">{item.when}</span>
      </span>
      <span className="flex flex-wrap gap-x-4 text-xs">
        {item.hasCv && (
          <a href={`/api/docs/${item.n}/pdf?kind=cv`} target="_blank" rel="noreferrer" className="underline">
            Resume sent
          </a>
        )}
        {item.reportHref && (
          <Link href={item.reportHref} className="underline">
            Evaluation
          </Link>
        )}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="underline">
            Posting
          </a>
        )}
      </span>
      {MOVES[item.status] && (
        <span className="flex flex-wrap gap-2 pt-1">
          {MOVES[item.status].map((to) => (
            <button key={to} type="button" disabled={busy} onClick={() => move(to)} className="border border-[var(--lux-hair)] px-2 py-1 text-[13px] hover:border-[var(--lux-ink)]">
              {to}
            </button>
          ))}
        </span>
      )}
      {err && <span className="text-xs text-[#9b3b2f]">{err}</span>}
    </li>
  );
}

export function TrackerBoard({ board }: { board: MatchData["board"] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((c) => (
        <section key={c.key} aria-label={c.label} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between border-b border-[var(--lux-ink)] pb-2">
            <span className="lux-serif text-[1.4rem]">{c.label}</span>
            <span className="tabular-nums text-sm text-[var(--lux-mute)]">{board[c.key].length}</span>
          </div>
          <span className="text-xs text-[var(--lux-mute)]">{c.note}</span>
          {board[c.key].length === 0 ? (
            <p className="m-0 text-sm text-[var(--lux-mute)]">Nothing here.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {board[c.key].map((i) => (
                <Card key={i.n} item={i} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
