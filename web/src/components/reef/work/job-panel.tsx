"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MatchJob } from "@/lib/match-data";
import { ApplyButton } from "@/components/apply-button";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { CoverDraftButton } from "@/components/cover-draft-button";
import { Eyebrow } from "@/components/lux/primitives";
import { MatchScore, QualList, sortedQuals } from "@/components/reef/work/match-card";
import { setStatus, undoStatus } from "@/components/reef/work/status-actions";

function DocRow({ label, ready, href, children }: { label: string; ready: boolean; href: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 border-b border-[var(--lux-hair)] py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className={ready ? "text-[var(--lux-accent)]" : "text-[var(--lux-mute)]"}>
            {ready ? "●" : "○"}
          </span>
          <span className="lux-serif text-[1.15rem] leading-tight">{label}</span>
        </span>
        {ready ? (
          <a href={href} target="_blank" rel="noreferrer" className="lux-link shrink-0">
            <span className="lux-u">View</span>
          </a>
        ) : (
          <span className="lux-tag shrink-0">Not made yet</span>
        )}
      </div>
      {!ready && children}
    </li>
  );
}

export function Documents({ job }: { job: MatchJob }) {
  const view = (kind: string) => `/api/docs/${job.n}/pdf?kind=${kind}`;
  const needsSoq = job.calcareers || job.needs.soq;
  const wantsCover = !job.calcareers || job.needs.cover;
  return (
    <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
      <DocRow label="Tailored resume" ready={job.docs.cv} href={view("cv")}>
        <div>
          <GeneratePdfButton n={job.report || job.n} company={job.employer} pdfReady={job.pdfReady} />
        </div>
      </DocRow>
      {wantsCover && (
        <DocRow label="Cover letter" ready={job.docs.cover} href={view("cover")}>
          {job.report ? (
            <div>
              <CoverDraftButton n={job.report} company={job.employer} />
            </div>
          ) : (
            <span className="text-xs text-[var(--lux-mute)]">Needs an evaluation report first.</span>
          )}
        </DocRow>
      )}
      {needsSoq && (
        <DocRow label="Statement of Qualifications" ready={job.docs.soq} href={view("soq")}>
          <span className="text-xs leading-snug text-[var(--lux-mute)]">
            In Claude Code: <code>/career-ops soq {job.n}</code>, or in Chrome ask Claude to use career-reef-soq.
          </span>
        </DocRow>
      )}
    </ul>
  );
}

/** "I submitted it" and "Skip": the two tracker moves a match can make from here. */
export function DecisionButtons({ job, onDone }: { job: MatchJob; onDone?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; undo?: boolean } | null>(null);
  const act = async (status: string, text: string) => {
    setBusy(true);
    const err = await setStatus(job.n, status);
    setBusy(false);
    setMsg(err ? { text: err } : { text, undo: true });
    if (!err) router.refresh();
  };
  const undo = async () => {
    setBusy(true);
    const err = await undoStatus(job.n);
    setBusy(false);
    setMsg(err ? { text: err } : { text: "Undone." });
    if (!err) router.refresh();
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} className="lux-btn lux-btn-sm" onClick={() => act("Applied", `Marked applied: ${job.employer}.`)}>
          I submitted it
        </button>
        <button type="button" disabled={busy} className="lux-btn lux-btn-sm" onClick={() => act("Discarded", `Skipped: ${job.employer}.`)}>
          Skip this job
        </button>
      </div>
      {msg && (
        <p className="m-0 text-center text-xs text-[var(--lux-mute)]" role="status">
          {msg.text}{" "}
          {msg.undo && (
            <button type="button" className="underline" onClick={undo} disabled={busy}>
              Undo
            </button>
          )}
          {msg.undo && onDone && (
            <button type="button" className="ml-3 underline" onClick={onDone}>
              Close
            </button>
          )}
        </p>
      )}
    </div>
  );
}

export function JobPanel({ job, onClose }: { job: MatchJob; onClose: () => void }) {
  const quals = sortedQuals(job.qualifications);
  return (
    <div className="flex flex-col gap-7 px-6 pb-10 sm:px-10">
      <div className="sticky top-0 z-10 -mx-6 flex h-[var(--lux-nav-h)] items-center justify-between bg-[var(--lux-paper)] px-6 sm:-mx-10 sm:px-10">
        <span className="lux-eyebrow">{job.lane === "ready" ? "Ready to apply" : "Needs documents"}</span>
        <button onClick={onClose} className="lux-link" aria-label="Close job details">
          <span className="lux-u">Close</span>
        </button>
      </div>
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-3">
          <span className="lux-eyebrow">{job.employer}</span>
          <h2 id="reef-job-title" className="lux-display m-0 text-[2rem] sm:text-[2rem]">{job.title}</h2>
          <p className="m-0 text-sm text-[var(--lux-mute)]">
            {[job.salary !== "Not stated" ? job.salary : "", job.location].filter(Boolean).join(" · ")}
          </p>
        </div>
        <MatchScore match={job.match} large />
      </div>

      {job.strengths.length > 0 && (
        <div className="flex flex-col gap-2 border-l border-[var(--lux-gold)] pl-4">
          <Eyebrow>Why it fits</Eyebrow>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] leading-relaxed">
            {job.strengths.slice(0, 4).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {quals.length > 0 && (
        <div className="flex flex-col gap-3">
          <Eyebrow>Qualifications</Eyebrow>
          <QualList items={quals} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        <Eyebrow>Your documents</Eyebrow>
        <Documents job={job} />
      </div>

      <div className="flex flex-col gap-3">
        <ApplyButton large n={job.n} url={job.url || undefined} company={job.employer} pdfReady={job.pdfReady} />
        <p className="m-0 text-center text-xs text-[var(--lux-mute)]">
          Opens the application and fills it with your documents and saved answers. It stops at Submit: you read it and press Submit yourself.
        </p>
        <DecisionButtons job={job} onDone={onClose} />
      </div>

      {job.zone === "kelp" && (
        <p className="m-0 border-l border-[var(--lux-gold)] pl-4 text-[13px] text-[var(--lux-mute)]">
          Not yet confirmed open at the employer. {job.verify}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        {job.url && (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="lux-link">
            <span className="lux-u">Open posting</span>
            <span className="lux-arrow" aria-hidden="true">→</span>
          </a>
        )}
        {job.reportHref && (
          <Link href={job.reportHref} className="lux-link">
            <span className="lux-u">Full evaluation</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/** The right-hand drawer used by Matches, Home and the queue. */
export function JobDrawer({ job, onClose }: { job: MatchJob | null; onClose: () => void }) {
  return (
    <>
      <div className={`lux-scrim${job ? " open" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside
        className={`lux-drawer lux-drawer-right${job ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reef-job-title"
        aria-hidden={!job}
        inert={!job}
      >
        {job && <JobPanel job={job} onClose={onClose} />}
      </aside>
    </>
  );
}
