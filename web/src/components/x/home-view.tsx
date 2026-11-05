"use client";

import Link from "next/link";
import type { XData } from "@/lib/x-data";
import { Eyebrow, StatFigure } from "@/components/lux/primitives";
import { MatchCard } from "@/components/x/match-card";
import { JobDrawer } from "@/components/x/job-panel";
import { useSelectedJob } from "@/components/x/use-selected-job";

type Check = { label: string; done: boolean; href: string; action: string };

export function HomeView({ data }: { data: XData }) {
  const top = data.jobs.slice(0, 3);
  const [sel, setSel] = useSelectedJob(top.map((j) => j.id));
  const selected = top.find((j) => j.id === sel) ?? null;
  const recent = [...data.board.applied, ...data.board.process, ...data.board.offer].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 5);

  const checks: Check[] = [
    { label: "Resume added", done: data.resume.exists, href: "/x/start", action: "Add resume" },
    { label: "Target roles and salary set", done: Boolean(data.targetLabel), href: "/x/start", action: "Set preferences" },
    { label: "Jobs scanned", done: Boolean(data.lastScan), href: "/explore", action: "Search jobs" },
    { label: "First documents ready", done: data.stats.ready > 0 || data.jobs.some((j) => j.docs.cv), href: "/x/queue", action: "Prepare" },
  ];
  const left = checks.filter((c) => !c.done);
  const nextJob = data.jobs.find((j) => j.lane === "ready");

  return (
    <div className="flex flex-col gap-16">
      {/* One primary action, aiapply-style */}
      <section className="grid items-end gap-8 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Eyebrow>Today</Eyebrow>
          <h1 className="lux-display m-0" style={{ fontSize: "var(--lux-t-h2)" }}>
            {data.stats.ready > 0 ? (
              <>
                {data.stats.ready} {data.stats.ready === 1 ? "job is" : "jobs are"} <em>ready to apply.</em>
              </>
            ) : (
              <>
                {data.stats.matches} matches, <em>none ready yet.</em>
              </>
            )}
          </h1>
          <p className="lux-lede m-0 max-w-xl">
            Each one has its tailored resume, plus the SOQ when the posting asks. Open it, the form fills itself, you read it and press Submit.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {nextJob ? (
            <Link href="/x/queue" className="lux-btn lux-btn-solid">Review and apply</Link>
          ) : (
            <Link href="/x/queue" className="lux-btn lux-btn-solid">Prepare documents</Link>
          )}
          <Link href="/x/jobs" className="lux-btn">Browse all matches</Link>
        </div>
      </section>

      {left.length > 0 && (
        <section aria-label="Setup" className="flex flex-col gap-3 border border-[var(--lux-gold)] bg-[var(--lux-white)] p-6">
          <Eyebrow>Finish setting up · {checks.length - left.length} of {checks.length} done</Eyebrow>
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
            {checks.map((c) => (
              <li key={c.label} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span aria-hidden="true" className={c.done ? "text-[var(--lux-accent)]" : "text-[var(--lux-mute)]"}>
                    {c.done ? "✓" : "○"}
                  </span>{" "}
                  {c.label}
                </span>
                {!c.done && (
                  <Link href={c.href} className="lux-link">
                    <span className="lux-u">{c.action}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="At a glance" className="border-y border-[var(--lux-hair)] bg-[var(--lux-white)]">
        <div className="lux-stats">
          <StatFigure value={data.stats.matches} label="Matches" />
          <StatFigure value={data.stats.ready} label="Ready to apply" />
          <StatFigure value={data.stats.appliedThisWeek} label="Applied this week" />
          <StatFigure value={data.stats.interviews} label="Interviews" />
        </div>
      </section>

      <section aria-labelledby="top-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="top-h" className="lux-display m-0" style={{ fontSize: "var(--lux-t-h3)" }}>
            Your best <em>matches</em>
          </h2>
          <Link href="/x/jobs" className="lux-link">
            <span className="lux-u">See all {data.stats.matches}</span>
            <span className="lux-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
        {top.length === 0 ? (
          <p className="lux-lede m-0">No matches yet. Run a search to find some.</p>
        ) : (
          <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-3">
            {top.map((j) => (
              <li key={j.id} className="flex">
                <MatchCard job={j} onOpen={() => setSel(j.id)} selected={j.id === sel} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-h" className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="recent-h" className="lux-display m-0" style={{ fontSize: "var(--lux-t-h3)" }}>
              Recent <em>applications</em>
            </h2>
            <Link href="/x/tracker" className="lux-link">
              <span className="lux-u">Open tracker</span>
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="m-0 text-sm text-[var(--lux-mute)]">No applications yet.</p>
          ) : (
            <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
              {recent.map((a) => (
                <li key={a.n} className="flex items-baseline justify-between gap-4 border-b border-[var(--lux-hair)] py-3 text-sm">
                  <span>
                    <span className="lux-serif text-[1.1rem]">{a.company}</span> <span className="text-[var(--lux-mute)]">· {a.role}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="lux-tag">{a.status}</span>
                    <span className="tabular-nums text-xs text-[var(--lux-mute)]">{a.when}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 border border-[var(--lux-hair)] bg-[var(--lux-white)] p-6 text-sm">
          <Eyebrow>Job search, running</Eyebrow>
          <p className="m-0">
            Last scan:{" "}
            {data.lastScan ? (
              <>
                {data.lastScan.at.slice(0, 16).replace("T", " ")} · {data.lastScan.found} found, {data.lastScan.newAdded} new
              </>
            ) : (
              "none logged"
            )}
          </p>
          <p className="m-0">{data.stats.inbox} new postings waiting to be scored.</p>
          <p className="m-0 text-[var(--lux-mute)]">Nothing is ever submitted for you. Every application stops at Submit.</p>
          <Link href="/pipeline?tab=INBOX" className="lux-link">
            <span className="lux-u">Score the inbox</span>
          </Link>
        </div>
      </section>
      <JobDrawer job={selected} onClose={() => setSel(null)} />
    </div>
  );
}
