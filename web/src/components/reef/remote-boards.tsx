"use client";

import { useMemo, useState } from "react";
import type { RemoteJob, RemoteSource, SourceHealth } from "@/lib/remote-boards";
import { cn } from "@/lib/cn";

// Remote boards on Reef Watch: one chip per board (health dot, last scan,
// counts) that filters the list below to that board's scored pipeline rows.
// Rows link to the board's own posting page (each board's terms ask for a
// link back). Evaluating, tailoring and "Open & fill" happen once a row is
// evaluated into the tracker; nothing here applies or submits.

const DOT: Record<SourceHealth, string> = {
  OK: "bg-emerald-500",
  "Rate-limited": "bg-amber-500",
  "Needs sign-in": "bg-orange-500",
  Error: "bg-red-500",
  Off: "bg-zinc-400",
  "Not scanned": "bg-zinc-300",
};

function when(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function RemoteBoards({ sources, jobs }: { sources: RemoteSource[]; jobs: RemoteJob[] }) {
  const [only, setOnly] = useState<string | null>(null);
  const [hideLow, setHideLow] = useState(true);
  const shown = useMemo(
    () => jobs.filter((j) => (!only || j.source === only) && (!hideLow || j.rank === null || j.rank >= 2.5)),
    [jobs, only, hideLow],
  );

  return (
    <div className="flex flex-col gap-8">
      <ul className="m-0 flex list-none flex-wrap gap-3 p-0" aria-label="Remote job boards">
        {sources.map((s) => {
          const active = only === s.name;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setOnly(active ? null : s.name)}
                title={s.detail}
                className={cn(
                  "flex flex-col items-start gap-1 border px-4 py-3 text-left transition-colors",
                  active ? "border-[var(--lux-ink)] bg-[var(--lux-white)]" : "border-[var(--lux-hair)] hover:border-[var(--lux-ink)]",
                )}
              >
                <span className="flex items-center gap-2 text-[15px]">
                  <span className={cn("inline-block size-2 rounded-full", DOT[s.health])} aria-hidden="true" />
                  {s.name}
                  {s.kind === "session" && <span className="lux-tag !py-0">Chrome session</span>}
                </span>
                <span className="text-xs text-[var(--lux-mute)]">
                  {s.health} · last scan {when(s.lastScan)} · {s.pending} waiting · {s.added} found all-time
                </span>
              </button>
              {s.health === "Needs sign-in" && s.loginUrl && (
                <a href={s.loginUrl} target="_blank" rel="noopener noreferrer" className="lux-link mt-1 text-xs">
                  <span className="lux-u">Open {s.host} to sign in</span>
                </a>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--lux-mute)]">
        <span>
          {shown.length} remote posting{shown.length === 1 ? "" : "s"}
          {only ? ` from ${only}` : ""}, best score first. Scored by the ranker; &quot;fallback&quot; means the AI ranker was unavailable.
        </span>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={hideLow} onChange={(e) => setHideLow(e.target.checked)} />
          Hide scores under 2.5
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="lux-lede m-0 text-center">Nothing from the remote boards yet. The next scan fills this in.</p>
      ) : (
        <ul className="m-0 list-none p-0">
          {shown.map((j) => (
            <li key={j.url} className="grid gap-x-6 gap-y-1 border-t border-[var(--lux-hair)] py-4 md:grid-cols-[4.5rem_2fr_1fr_auto] md:items-baseline">
              <span className="lux-serif text-[1.4rem] tabular-nums">{j.rank === null ? "—" : j.rank.toFixed(1)}</span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px]">{j.title}</span>
                <span className="text-xs text-[var(--lux-mute)]">
                  {j.company} · {j.source} · {j.location}
                  {j.posted ? ` · posted ${j.posted}` : ""}
                </span>
                {j.reason && <span className="text-xs leading-snug text-[var(--lux-mute)]">{j.reason}</span>}
              </span>
              <span className="text-sm">
                {j.salaryUnknown ? <span className="lux-tag">Salary unknown</span> : j.salary}
              </span>
              <a href={j.url} target="_blank" rel="noopener noreferrer" className="lux-link justify-self-start">
                <span className="lux-u">View on {j.source}</span>
                <span className="lux-arrow" aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
