"use client";

import { useMemo, useState } from "react";
import type { MatchJob } from "@/lib/match-data";
import { useJobs } from "@/components/jobs/job-store";
import { ApplyButton } from "@/components/apply-button";
import { DisplayHeading } from "@/components/lux/primitives";
import { MatchScore } from "@/components/reef/work/match-card";
import { DecisionButtons, JobDrawer } from "@/components/reef/work/job-panel";
import { useSelectedJob } from "@/components/reef/work/use-selected-job";

const BATCH = 3;

function DocDots({ job }: { job: MatchJob }) {
  const needsSoq = job.calcareers || job.needs.soq;
  const wantsCover = !job.calcareers || job.needs.cover;
  const items = [
    { k: "Resume", on: job.docs.cv },
    ...(wantsCover ? [{ k: "Cover", on: job.docs.cover }] : []),
    ...(needsSoq ? [{ k: "SOQ", on: job.docs.soq }] : []),
  ];
  return (
    <span className="flex flex-wrap gap-3 text-xs text-[var(--lux-mute)]">
      {items.map((i) => (
        <span key={i.k}>
          <span aria-hidden="true" className={i.on ? "text-[var(--lux-accent)]" : ""}>
            {i.on ? "●" : "○"}
          </span>{" "}
          {i.k}
          <span className="sr-only">{i.on ? " ready" : " missing"}</span>
        </span>
      ))}
    </span>
  );
}

// The apply queue: documents can be prepared in one
// press (and the scheduled queue feeder prepares them unattended), but the last
// step is always Open & fill, which stops at the employer's Submit button.
export function QueueView({ jobs }: { jobs: MatchJob[] }) {
  const { jobs: workers, startJob } = useJobs();
  const [sel, setSel] = useSelectedJob(jobs.map((j) => j.id));
  const [started, setStarted] = useState<string[]>([]);
  const selected = jobs.find((j) => j.id === sel) ?? null;
  const ready = jobs.filter((j) => j.lane === "ready");
  const prepare = jobs.filter((j) => j.lane === "prepare");

  const running = useMemo(() => new Set(workers.filter((w) => w.kind === "pdf" && w.status === "running").map((w) => w.input)), [workers]);
  const needCv = prepare.filter((j) => !j.docs.cv && j.report && !running.has(j.report) && !started.includes(j.report));
  const prepareNext = () => {
    const batch = needCv.slice(0, BATCH);
    for (const j of batch) startJob({ title: `Resume · ${j.employer}`, subtitle: "tailored for this role", kind: "pdf", input: j.report, page: "/reef/queue" });
    setStarted((s) => [...s, ...batch.map((j) => j.report)]);
  };

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="ready-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <DisplayHeading as="h2" size="h3" id="ready-h" em="apply">
            Ready to{" "}
          </DisplayHeading>
          <span className="text-sm text-[var(--lux-mute)]">{ready.length} waiting for your review</span>
        </div>
        {ready.length === 0 ? (
          <p className="lux-lede m-0">Nothing is ready yet. Prepare documents below and jobs move up here.</p>
        ) : (
          <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
            {ready.map((j) => (
              <li key={j.id} className="grid gap-4 border-b border-[var(--lux-hair)] py-5 md:grid-cols-[2fr_auto_1.4fr] md:items-center">
                <button type="button" onClick={() => setSel(j.id)} className="flex flex-col gap-1 border-0 bg-transparent p-0 text-left text-inherit">
                  <span className="lux-eyebrow">{j.employer}</span>
                  <span className="lux-serif text-[1.35rem] leading-tight">{j.title}</span>
                  <DocDots job={j} />
                  {j.zone === "kelp" && <span className="lux-tag self-start">Verify open first</span>}
                </button>
                <MatchScore match={j.match} />
                <div className="flex flex-col gap-2">
                  <ApplyButton large n={j.n} url={j.url || undefined} company={j.employer} pdfReady={j.pdfReady} />
                  <DecisionButtons job={j} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="prep-h" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <DisplayHeading as="h2" size="h3" id="prep-h" em="documents">
            Needs{" "}
          </DisplayHeading>
          <button type="button" className="lux-btn lux-btn-solid lux-btn-sm" disabled={needCv.length === 0} onClick={prepareNext}>
            {needCv.length === 0 ? "All resumes started" : `Make the next ${Math.min(BATCH, needCv.length)} resumes`}
          </button>
        </div>
        <p className="m-0 max-w-3xl text-sm text-[var(--lux-mute)]">
          One press tailors a resume for each of the top matches still missing one, {BATCH} at a time. Cover letters and SOQs need your answers, so open a job to write them, or let the scheduled queue feeder draft them for every 3.5+ job. Nothing is ever sent.
        </p>
        {prepare.length === 0 ? (
          <p className="lux-lede m-0">Every match has its documents.</p>
        ) : (
          <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
            {prepare.map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--lux-hair)] py-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-sm">
                    <span className="lux-serif text-[1.15rem]">{j.title}</span> <span className="text-[var(--lux-mute)]">· {j.employer}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-3">
                    <DocDots job={j} />
                    {j.zone === "kelp" && <span className="lux-tag">Verify open first</span>}
                    {(running.has(j.report) || started.includes(j.report)) && <span className="lux-tag">Making resume…</span>}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <span className="tabular-nums text-sm">{j.match}/100</span>
                  <button type="button" className="lux-link" onClick={() => setSel(j.id)}>
                    <span className="lux-u">Prepare</span>
                    <span className="lux-arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <JobDrawer job={selected} onClose={() => setSel(null)} />
    </div>
  );
}
