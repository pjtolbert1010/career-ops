"use client";

import type { ReefJob } from "@/lib/reef-data";
import { cn } from "@/lib/cn";

/** Remote / Hybrid / On-site from the location text, or "" when it doesn't say. */
export function workStyle(location: string): string {
  if (/remote/i.test(location)) return /hybrid/i.test(location) ? "Hybrid" : "Remote";
  if (/hybrid/i.test(location)) return "Hybrid";
  if (/on-?site|in[- ]office/i.test(location)) return "On-site";
  return "";
}

// A posting as a piece in a collection: serif title, house, price line,
// work style, and the fit score as a refined badge. Hover reveals actions;
// on touch they're always visible.
export function JobCard({
  job,
  prepped,
  zoneLabel,
  onOpen,
  selected,
}: {
  job: ReefJob;
  prepped: boolean;
  zoneLabel: string;
  onOpen: () => void;
  selected?: boolean;
}) {
  const style = workStyle(job.location);
  return (
    <article className={cn("lux-card w-full", selected && "border-[var(--lux-ink)]")}>
      <div className="flex items-start justify-between gap-4 px-7 pt-7">
        <span className="lux-eyebrow">{zoneLabel}</span>
        <span className="lux-badge" data-top={job.fit >= 8 ? "true" : "false"} aria-label={`Fit ${job.fit} of 10`}>
          {job.fit}
          <small aria-hidden="true">/10</small>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-7 pb-6 pt-8">
        <h3 className="lux-display m-0 text-[1.65rem] leading-[1.1]">
          <button
            type="button"
            onClick={onOpen}
            aria-pressed={selected}
            className="cursor-pointer border-0 bg-transparent p-0 text-left text-inherit after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {job.title}
          </button>
        </h3>
        <p className="m-0 text-sm text-[var(--lux-mute)]">{job.employer}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {job.salary && <span className="text-[13px] tabular-nums">{job.salary}</span>}
          {style && <span className="lux-tag">{style}</span>}
          {prepped && <span className="lux-tag border-[var(--lux-gold)] text-[var(--lux-ink)]">Prepped</span>}
        </div>
      </div>
      <div className="lux-card-actions relative z-[1] flex items-center justify-between gap-4 border-t border-[var(--lux-hair)] px-7 py-3">
        <button type="button" onClick={onOpen} className="lux-link" tabIndex={-1} aria-hidden="true">
          <span className="lux-u">{prepped ? "Review application" : "View details"}</span>
          <span className="lux-arrow">→</span>
        </button>
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="lux-link" aria-label={`Open posting for ${job.title} at ${job.employer}`}>
            <span className="lux-u">Posting</span>
          </a>
        )}
      </div>
    </article>
  );
}
