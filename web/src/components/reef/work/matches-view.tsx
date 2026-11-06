"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { MatchJob } from "@/lib/match-data";
import { MatchCard } from "@/components/reef/work/match-card";
import { JobDrawer } from "@/components/reef/work/job-panel";
import { useSelectedJob } from "@/components/reef/work/use-selected-job";

const MIN_OPTIONS = [0, 60, 70, 80];

// Job search over the evaluated matches: one search box, three
// filters, cards with a /100 score and a qualification checklist.
export function MatchesView({ jobs }: { jobs: MatchJob[] }) {
  const [q, setQ] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [readyOnly, setReadyOnly] = useState(false);
  const [min, setMin] = useState(0);
  const [sel, setSel] = useSelectedJob(jobs.map((j) => j.id));
  const selected = jobs.find((j) => j.id === sel) ?? null;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        (!needle || `${j.title} ${j.employer} ${j.location}`.toLowerCase().includes(needle)) &&
        (!remoteOnly || j.remote) &&
        (!readyOnly || j.lane === "ready") &&
        j.match >= min,
    );
  }, [jobs, q, remoteOnly, readyOnly, min]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 border border-[var(--lux-hair)] bg-[var(--lux-white)] p-5 md:flex-row md:items-center">
        <label className="flex flex-1 flex-col gap-1">
          <span className="lux-eyebrow">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Role, company or place"
            className="min-h-[44px] border-0 border-b border-[var(--lux-hair)] bg-transparent text-[15px] text-[var(--lux-ink)] outline-none focus:border-[var(--lux-ink)]"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} /> Remote only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={readyOnly} onChange={(e) => setReadyOnly(e.target.checked)} /> Ready to apply
        </label>
        <label className="flex items-center gap-2 text-sm">
          Match at least
          <select value={min} onChange={(e) => setMin(Number(e.target.value))} className="min-h-[40px] border border-[var(--lux-hair)] bg-transparent px-2">
            {MIN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m === 0 ? "any" : m}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="m-0 text-sm text-[var(--lux-mute)]">
        {shown.length} of {jobs.length} matches. Want more?{" "}
        <Link href="/explore" className="underline">
          Search for new jobs
        </Link>{" "}
        or check the{" "}
        <Link href="/pipeline?tab=INBOX" className="underline">
          inbox
        </Link>
        .
      </p>

      {shown.length === 0 ? (
        <p className="lux-lede text-center">No matches with these filters.</p>
      ) : (
        <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((j) => (
            <li key={j.id} className="flex">
              <MatchCard job={j} onOpen={() => setSel(j.id)} selected={j.id === sel} />
            </li>
          ))}
        </ul>
      )}
      <JobDrawer job={selected} onClose={() => setSel(null)} />
    </div>
  );
}
