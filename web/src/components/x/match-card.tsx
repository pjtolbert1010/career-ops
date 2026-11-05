"use client";

import type { XJob, Qualification } from "@/lib/x-data";
import { cn } from "@/lib/cn";

export function fitLabel(match: number): string {
  if (match >= 85) return "Excellent fit";
  if (match >= 75) return "Strong fit";
  if (match >= 65) return "Good fit";
  return "Stretch";
}

export function MatchScore({ match, large = false }: { match: number; large?: boolean }) {
  return (
    <span className="flex flex-col items-end gap-1" aria-label={`Match ${match} of 100, ${fitLabel(match)}`}>
      <span className="lux-badge" data-top={match >= 80 ? "true" : "false"} style={large ? { fontSize: "1.6rem" } : undefined}>
        {match}
        <small aria-hidden="true">/100</small>
      </span>
      <span className="text-[10px] uppercase tracking-[.18em] text-[var(--lux-mute)]">{fitLabel(match)}</span>
    </span>
  );
}

export function QualMark({ met }: { met: Qualification["met"] }) {
  const sign = met === "yes" ? "✓" : met === "no" ? "✗" : "~";
  const tone = met === "yes" ? "text-[var(--lux-accent)]" : met === "no" ? "text-[#9b3b2f]" : "text-[var(--lux-gold-text)]";
  const label = met === "yes" ? "Met" : met === "no" ? "Not met" : "Partly met";
  return (
    <span className={cn("inline-block w-4 shrink-0 text-center font-semibold", tone)} aria-label={label} title={label}>
      {sign}
    </span>
  );
}

export function QualList({ items, limit }: { items: Qualification[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (!shown.length) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {shown.map((q) => (
        <li key={q.text} className="flex items-start gap-2 text-[13px] leading-snug">
          <QualMark met={q.met} />
          <span>{q.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Met first, then partial, then missing: the aiapply checklist order. */
export function sortedQuals(items: Qualification[]): Qualification[] {
  const rank = { yes: 0, partial: 1, no: 2 } as const;
  return [...items].sort((a, b) => rank[a.met] - rank[b.met]);
}

export function MatchCard({ job, onOpen, selected }: { job: XJob; onOpen: () => void; selected?: boolean }) {
  const quals = sortedQuals(job.qualifications);
  const preview = [...quals.filter((q) => q.met === "yes").slice(0, 2), ...quals.filter((q) => q.met === "no").slice(0, 1)];
  return (
    <article className={cn("lux-card w-full", selected && "border-[var(--lux-ink)]")}>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="lux-eyebrow truncate">{job.employer}</span>
          <h3 className="lux-display m-0 text-[1.5rem] leading-[1.12]">
            <button
              type="button"
              onClick={onOpen}
              className="cursor-pointer border-0 bg-transparent p-0 text-left text-inherit after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {job.title}
            </button>
          </h3>
        </div>
        <MatchScore match={job.match} />
      </div>
      <div className="flex flex-wrap items-center gap-2 px-6 pt-3 text-[13px]">
        {job.salary && job.salary !== "Not stated" && <span className="tabular-nums">{job.salary}</span>}
        {job.remote && <span className="lux-tag">Remote</span>}
        {job.lane === "ready" ? (
          <span className="lux-tag border-[var(--lux-gold)] text-[var(--lux-ink)]">Ready to apply</span>
        ) : (
          <span className="lux-tag">Needs documents</span>
        )}
        {job.zone === "kelp" && <span className="lux-tag">Verify open</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-6 pb-6 pt-4">
        {job.strengths[0] && (
          <p className="m-0 text-[13px] leading-snug text-[var(--lux-mute)]">
            <span className="text-[var(--lux-ink)]">Why it fits: </span>
            {job.strengths[0]}
          </p>
        )}
        <QualList items={preview} />
      </div>
    </article>
  );
}
