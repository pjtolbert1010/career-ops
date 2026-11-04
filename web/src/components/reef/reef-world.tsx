"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ReefApplied, ReefData, ReefJob, ReefZone } from "@/lib/reef-data";
import { cn } from "@/lib/cn";
import { ApplyButton } from "@/components/apply-button";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { HeroVideo } from "@/components/lux/hero-video";
import { DisplayHeading, Eyebrow, ImageSlot, Intro, PrimaryAction, Reveal, Section, StatFigure } from "@/components/lux/primitives";
import { JobCard, workStyle } from "@/components/lux/job-card";
import { StatusPanel } from "@/components/lux/status-panel";
import { PipelineTimeline } from "@/components/lux/pipeline-timeline";

// Reef Watch, editorial edition. Same data and the same actions as before
// (job detail with ?job= in the URL, Apply, Generate CV, tailored documents,
// the applied list, the shallows), laid out as a quiet-luxury overview.
// Nothing here submits an application: Apply opens the pre-filled form and
// the user presses Submit themselves.

const ZONE_NAME: Record<ReefZone, string> = { reef: "Apply-first", shelf: "A closer look", kelp: "Verify first" };
const ZONE_NOTE: Record<ReefZone, string> = {
  reef: "Confirmed open, score 4.0 and above",
  shelf: "Confirmed open, worth a closer read",
  kelp: "Not yet confirmed at the employer",
};

export type MediaSlots = { openings: boolean; review: boolean; pipeline: boolean };

/** Prepped: the tailored CV exists, plus the SOQ when the posting calls for one. */
export function isPrepped(j: ReefJob): boolean {
  const needsSoq = j.calcareers || j.needs.soq;
  return j.pdfReady && j.docs.cv && (!needsSoq || j.docs.soq);
}

function docLinks(job: ReefJob) {
  const showSoq = job.calcareers || job.needs.soq;
  const showCover = !job.calcareers || job.needs.cover;
  const view = (kind: string) => `/api/docs/${job.n}/pdf?kind=${kind}`;
  const rows: { label: string; ready: boolean; href: string; need?: string; make: string }[] = [
    { label: "Tailored CV", ready: job.docs.cv, href: view("cv"), make: "Use Generate CV to make it." },
  ];
  if (showSoq)
    rows.push({
      label: "Statement of Qualifications",
      ready: job.docs.soq,
      href: view("soq"),
      need: job.needs.soq ? "This posting requires an SOQ." : job.calcareers ? "This posting does not list an SOQ." : undefined,
      make: `In Chrome on the posting, ask Claude to use career-reef-soq. Or in Claude Code: /career-ops soq ${job.n}`,
    });
  if (showCover)
    rows.push({
      label: "Cover letter",
      ready: job.docs.cover,
      href: view("cover"),
      need:
        job.calcareers && job.needs.cover
          ? `This posting asks for a cover letter${job.needs.coverPageLimit ? ` (max ${job.needs.coverPageLimit} page${job.needs.coverPageLimit > 1 ? "s" : ""})` : ""}.`
          : undefined,
      make: `In Chrome on the application, ask Claude to use career-reef-cover-letter. Or in Claude Code: /career-ops cover ${job.n}`,
    });
  return rows;
}

function Documents({ job, compact = false }: { job: ReefJob; compact?: boolean }) {
  return (
    <div className="flex flex-col">
      {!compact && <Eyebrow className="mb-3">Documents</Eyebrow>}
      <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
        {docLinks(job).map((d) => (
          <li key={d.label} className="flex flex-col gap-1 border-b border-[var(--lux-hair)] py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="lux-serif text-[1.2rem] leading-tight">{d.label}</span>
              {d.ready ? (
                <a href={d.href} target="_blank" rel="noreferrer" className="lux-link shrink-0">
                  <span className="lux-u">View</span>
                  <span className="lux-arrow" aria-hidden="true">→</span>
                </a>
              ) : (
                <span className="lux-tag shrink-0">Not made yet</span>
              )}
            </div>
            {d.need && <span className="text-xs text-[var(--lux-gold-text)]">{d.need}</span>}
            {!d.ready && <span className="text-xs leading-snug text-[var(--lux-mute)]">{d.make}</span>}
          </li>
        ))}
      </ul>
      {!compact && <p className="mt-3 text-xs text-[var(--lux-mute)]">The career-ops Apply extension attaches these to the form when its document toggles are on.</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--lux-hair)] pt-3">
      <span className="lux-eyebrow">{label}</span>
      <span className="text-[15px]">{value || "—"}</span>
    </div>
  );
}

function JobDetail({ job, onClose }: { job: ReefJob; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-7 px-6 pb-10 sm:px-10">
      <div className="sticky top-0 z-10 -mx-6 flex h-[var(--lux-nav-h)] items-center justify-between bg-[var(--lux-paper)] px-6 sm:-mx-10 sm:px-10">
        <span className="lux-eyebrow">{ZONE_NAME[job.zone]}</span>
        <button onClick={onClose} className="lux-link" aria-label="Close job details">
          <span className="lux-u">Close</span>
        </button>
      </div>
      <div className="flex flex-col gap-3">
        <span className="lux-eyebrow">{job.employer}</span>
        <h2 id="lux-job-title" className="lux-display m-0 text-[2.25rem] sm:text-[2.6rem]">{job.title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <span className="lux-badge" data-top={job.fit >= 8 ? "true" : "false"}>
          {job.fit}
          <small>/10 FIT</small>
        </span>
        <div className="h-px flex-1 bg-[var(--lux-hair)]">
          <div className="h-px bg-[var(--lux-ink)]" style={{ width: `${job.fit * 10}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        <Fact label="Salary" value={job.salary} />
        <Fact label="Posted" value={job.posted} />
        <div className="col-span-2">
          <Fact label="Where" value={job.location} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow>Why it fits</Eyebrow>
        <p className="m-0 text-[15px] leading-relaxed">{job.note}</p>
      </div>
      {job.nextAction && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Next step</Eyebrow>
          <p className="m-0 text-[15px] leading-relaxed">{job.nextAction}</p>
        </div>
      )}
      <div className="flex flex-col gap-2 border-l border-[var(--lux-gold)] pl-4">
        <Eyebrow>Verification</Eyebrow>
        <p className="m-0 text-[14px] leading-snug text-[var(--lux-mute)]">{job.verify}</p>
      </div>
      <div className="flex flex-col gap-3">
        <ApplyButton large n={job.n} url={job.url || undefined} company={job.employer} pdfReady={job.pdfReady} />
        <p className="m-0 text-center text-xs text-[var(--lux-mute)]">Opens the form filled with your tailored CV and saved answers. You review and press Submit yourself.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <GeneratePdfButton n={job.n} company={job.employer} pdfReady={job.pdfReady} />
      </div>
      <Documents job={job} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        {job.url ? (
          <PrimaryAction href={job.url} external rule={false}>Open posting</PrimaryAction>
        ) : (
          <span className="text-[13px] text-[var(--lux-mute)]">No posting URL on file. Check the report.</span>
        )}
        {job.reportHref && (
          <PrimaryAction href={job.reportHref} rule={false}>Read the full report</PrimaryAction>
        )}
      </div>
    </div>
  );
}

function ReviewItem({ job, onOpen, index }: { job: ReefJob; onOpen: () => void; index: number }) {
  return (
    <Reveal as="li" delay={Math.min(index, 4) * 80} className="grid gap-8 border-t border-[var(--lux-hair)] py-10 md:grid-cols-[1.1fr_1fr] md:gap-14">
      <div className="flex flex-col gap-4">
        <span className="lux-eyebrow">{job.employer}</span>
        <h3 className="lux-display m-0 text-[1.9rem] sm:text-[2.3rem]">{job.title}</h3>
        <div className="flex flex-wrap items-center gap-3">
          <span className="lux-badge" data-top={job.fit >= 8 ? "true" : "false"}>
            {job.fit}
            <small>/10 FIT</small>
          </span>
          {job.salary && <span className="text-sm text-[var(--lux-mute)]">{job.salary}</span>}
          {workStyle(job.location) && <span className="lux-tag">{workStyle(job.location)}</span>}
        </div>
        <div>
          <PrimaryAction onClick={onOpen} rule={false}>Full details</PrimaryAction>
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <Documents job={job} compact />
        <ApplyButton large n={job.n} url={job.url || undefined} company={job.employer} pdfReady={job.pdfReady} />
        <p className="m-0 text-center text-xs text-[var(--lux-mute)]">Pre-filled for you. You review and press Submit yourself.</p>
      </div>
    </Reveal>
  );
}

function Applications({ applied }: { applied: ReefApplied[] }) {
  if (applied.length === 0) return <p className="lux-lede m-0 text-center">No applications yet.</p>;
  return (
    <ul className="m-0 list-none p-0">
      {applied.map((a) => (
        <li key={a.n} className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-1 border-t border-[var(--lux-hair)] py-5 md:grid-cols-[2fr_2fr_1fr_1fr_auto]">
          <span className="lux-serif text-[1.25rem] leading-tight">{a.company}</span>
          <span className="lux-tag justify-self-end md:order-3 md:justify-self-start">{a.status}</span>
          <span className="col-span-2 text-sm text-[var(--lux-mute)] md:order-2 md:col-span-1">{a.role}</span>
          <span className="text-xs tabular-nums text-[var(--lux-mute)] md:order-4">{a.when}</span>
          <span className="flex gap-5 md:order-5">
            {a.reportHref && (
              <Link href={a.reportHref} className="lux-link">
                <span className="lux-u">Report</span>
              </Link>
            )}
            {a.url && (
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="lux-link">
                <span className="lux-u">Posting</span>
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Filter = "all" | ReefZone;

export function ReefWorld({ data, slots }: { data: ReefData; slots: MediaSlots }) {
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const drawerRef = useRef<HTMLElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const selected = data.jobs.find((j) => j.id === sel) ?? null;
  const ready = useMemo(() => data.jobs.filter(isPrepped), [data.jobs]);
  const shown = filter === "all" ? data.jobs : data.jobs.filter((j) => j.zone === filter);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // The open job rides in the address bar (/reef?job=103), so Claude in
  // Chrome's career-reef-cv skill can tell which job was clicked, and a reload
  // keeps it open.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("job");
    if (id && data.jobs.some((j) => j.id === id)) setSel(id);
  }, [data.jobs]);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (sel) url.searchParams.set("job", sel);
    else url.searchParams.delete("job");
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [sel]);

  // Drawer: scroll lock, Escape, focus in and back.
  useEffect(() => {
    if (!sel) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSel(null);
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => drawerRef.current?.querySelector<HTMLElement>("button")?.focus(), 80);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      lastFocus.current?.focus?.();
    };
  }, [sel]);

  const pick = (id: string) => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setSel(id);
  };

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: data.jobs.length },
    ...(["reef", "shelf", "kelp"] as const).map((z) => ({ id: z, label: ZONE_NAME[z], count: data.jobs.filter((j) => j.zone === z).length })),
  ];

  const stages = [
    { label: "Found", count: data.stats.inboxPending, note: "In the inbox", href: "/pipeline" },
    { label: "Evaluated", count: data.jobs.length, note: "Scored, awaiting you", href: "#openings" },
    { label: "Prepped", count: ready.length, note: "Documents ready", href: "#review" },
    { label: "Submitted", count: data.applied.filter((a) => ["Applied", "Responded", "Assessment"].includes(a.status)).length, note: "Applied", href: "#applications" },
    { label: "Interview", count: data.stats.interviews, note: "Interview or offer", href: "#applications" },
  ];

  return (
    <div className="reef-lux">
      {/* 1 · HERO */}
      <HeroVideo>
        <div className="flex max-w-3xl flex-col gap-6">
          <Eyebrow>Reef Watch · {today}</Eyebrow>
          <DisplayHeading as="h1" size="hero" em="curated.">
            Your next role,
            <br />
          </DisplayHeading>
          <p className="m-0 max-w-xl text-base font-light leading-relaxed text-white/85 sm:text-lg">
            Every opening scored against your profile, every application prepared, nothing sent until you say so.
          </p>
          <div className="pt-2 text-white">
            <PrimaryAction href="#openings">Review today&apos;s openings</PrimaryAction>
          </div>
        </div>
      </HeroVideo>

      {/* 2 · AT A GLANCE */}
      <section aria-label="At a glance" className="border-b border-[var(--lux-hair)] bg-[var(--lux-white)] px-[var(--lux-s-gutter)]">
        <div className="lux-wrap">
          <Reveal className="lux-stats">
            <StatFigure value={data.jobs.length} label="New openings" />
            <StatFigure value={ready.length} label="Ready for review" />
            <StatFigure value={data.stats.appliedThisWeek} label="Applied this week" />
            <StatFigure value={data.stats.interviews} label="Interviews" />
          </Reveal>
        </div>
      </section>

      {/* 3 · CURATED OPENINGS */}
      <Section id="openings" labelledBy="openings-h">
        <div className="grid items-end gap-10 md:grid-cols-[1.2fr_1fr] md:gap-16">
          <Intro align="left" eyebrow="The collection" id="openings-h" heading={<>Curated </>} em="openings" lede={<>Roles you haven&apos;t applied to yet, scored for fit. Select one to see the details and apply. Applied roles move to the pipeline, so nothing is applied to twice.</>} />
          {slots.openings && <ImageSlot src="/media/section-openings.jpg" alt="" className="hidden aspect-[4/3] md:block" />}
        </div>

        <div className="mt-14 lux-tabs" role="tablist" aria-label="Filter openings">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={filter === t.id} onClick={() => setFilter(t.id)} className="lux-tab">
              {t.label} <span className="tabular-nums">({t.count})</span>
            </button>
          ))}
        </div>
        {filter !== "all" && <p className="mt-4 text-sm text-[var(--lux-mute)]">{ZONE_NOTE[filter]}</p>}

        {shown.length === 0 ? (
          <p className="lux-lede mt-12 text-center">Nothing here yet.</p>
        ) : (
          <ul className="m-0 mt-10 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((j, i) => (
              <Reveal as="li" key={j.id} delay={(i % 3) * 90} className="flex">
                <JobCard job={j} prepped={isPrepped(j)} zoneLabel={ZONE_NAME[j.zone]} onOpen={() => pick(j.id)} selected={j.id === sel} />
              </Reveal>
            ))}
          </ul>
        )}

        {data.shallows.length > 0 && (
          <Reveal className="mx-auto mt-20 max-w-2xl">
            <Eyebrow className="mb-4 text-center">The shallows · top pay under {data.targetLabel || "target"}</Eyebrow>
            <ul className="m-0 list-none p-0">
              {data.shallows.map((s) => (
                <li key={s.what} className="flex justify-between gap-4 border-t border-[var(--lux-hair)] py-3 text-sm">
                  <span>{s.what}</span>
                  <span className="whitespace-nowrap tabular-nums text-[var(--lux-mute)]">{s.pay}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </Section>

      {/* 4 · READY FOR REVIEW */}
      <Section id="review" tone="white" labelledBy="review-h">
        <div className={cn("grid items-center gap-10", slots.review && "md:grid-cols-[1fr_1.1fr] md:gap-16")}>
          {slots.review && <ImageSlot src="/media/section-review.jpg" alt="" className="hidden aspect-[4/5] md:block" />}
          <Intro
            align={slots.review ? "left" : "center"}
            eyebrow="Prepared for you"
            id="review-h"
            heading={<>Ready for </>}
            em="review."
            lede="Tailored CV and statement in hand. One press opens the application, already filled. Read it through, then submit it yourself."
          />
        </div>
        {ready.length === 0 ? (
          <Reveal className="mx-auto mt-14 max-w-xl text-center">
            <p className="lux-lede m-0">Nothing is fully prepared yet. Open an opening and use Generate CV; it appears here once its documents are ready.</p>
          </Reveal>
        ) : (
          <ul className="m-0 mt-14 list-none p-0">
            {ready.map((j, i) => (
              <ReviewItem key={j.id} job={j} index={i} onOpen={() => pick(j.id)} />
            ))}
          </ul>
        )}
      </Section>

      {/* 5 · APPLICATION PIPELINE */}
      <Section id="pipeline" labelledBy="pipeline-h">
        <Intro eyebrow="The movement" id="pipeline-h" heading={<>Application </>} em="pipeline" lede="From first sighting to the interview room, at a glance." />
        <Reveal className="mt-16">
          <PipelineTimeline stages={stages} />
        </Reveal>
        {slots.pipeline && <ImageSlot src="/media/section-pipeline.jpg" alt="" className="mt-20 aspect-[21/9]" />}
        <div id="applications" className="mt-20 scroll-mt-[96px]">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <DisplayHeading as="h3" size="h3" em="applications">Your </DisplayHeading>
            <PrimaryAction href="/pipeline" rule={false}>Open the full pipeline</PrimaryAction>
          </div>
          <Applications applied={data.applied} />
        </div>
      </Section>

      {/* 6 · REEF WATCH STATUS */}
      <Section id="status" tone="white" labelledBy="status-h">
        <Intro eyebrow="The atelier" id="status-h" heading={<>Reef Watch, </>} em="at work" lede="The scanner, the evaluator and the apply workers, quietly keeping time." />
        <Reveal className="mt-14">
          <StatusPanel lastScan={data.lastScan} inboxPending={data.stats.inboxPending} />
        </Reveal>
      </Section>

      {/* Job detail drawer */}
      <div className={cn("lux-scrim", selected && "open")} onClick={() => setSel(null)} aria-hidden="true" />
      <aside
        ref={drawerRef}
        className={cn("lux-drawer lux-drawer-right", selected && "open")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lux-job-title"
        aria-hidden={!selected}
        inert={!selected}
      >
        {selected && <JobDetail job={selected} onClose={() => setSel(null)} />}
      </aside>
    </div>
  );
}
