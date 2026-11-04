"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { useApply } from "@/components/apply/apply-provider";
import type { ReefData } from "@/lib/reef-data";

type Tone = "ok" | "run" | "err" | "idle";

function ago(ts: number | string | undefined, now: number): string {
  if (!ts) return "never";
  const t = typeof ts === "number" ? ts : Date.parse(ts);
  if (!Number.isFinite(t)) return "unknown";
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

function Row({ name, tone, state, detail, href }: { name: string; tone: Tone; state: string; detail: string; href?: string }) {
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className="lux-status-dot" data-tone={tone} aria-hidden="true" />
        <span className="lux-serif text-[1.35rem] leading-tight">{name}</span>
      </span>
      <span className="lux-eyebrow md:text-center">{state}</span>
      <span className="text-sm text-[var(--lux-mute)] md:text-right">{detail}</span>
    </>
  );
  const cls = "grid grid-cols-1 gap-1.5 border-t border-[var(--lux-hair)] py-6 text-inherit no-underline md:grid-cols-[1.2fr_1fr_1.4fr] md:items-center md:gap-6";
  return <li>{href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

function worker(jobs: Job[], kinds: string[], now: number, idleText: string): { tone: Tone; state: string; detail: string } {
  const mine = jobs.filter((j) => j.kind && kinds.includes(j.kind));
  const running = mine.filter((j) => j.status === "running");
  if (running.length) return { tone: "run", state: `${running.length} running`, detail: running[0].title };
  const last = mine[0];
  if (!last) return { tone: "idle", state: "Idle", detail: idleText };
  if (last.status === "error") return { tone: "err", state: "Needs attention", detail: `${last.title} · ${ago(last.endedAt ?? last.startedAt, now)}` };
  return { tone: "ok", state: "Idle", detail: `Last: ${last.title} · ${ago(last.endedAt ?? last.startedAt, now)}` };
}

// The live system view: scanner, evaluator, CV builder, apply worker, errors.
export function StatusPanel({ lastScan, inboxPending }: { lastScan: ReefData["lastScan"]; inboxPending: number }) {
  const { jobs } = useJobs();
  const apply = useApply();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);

  const scanTone: Tone = !lastScan ? "idle" : lastScan.errors > 0 || lastScan.status !== "completed" ? "err" : "ok";
  const evaluator = worker(jobs, ["evaluate"], now, "No evaluations this session");
  const builder = worker(jobs, ["pdf", "cover", "soq"], now, "No documents built this session");
  const applyRunning = apply.status !== "idle" && apply.status !== "done" && apply.status !== "error";
  const applyTone: Tone = apply.status === "error" ? "err" : applyRunning ? "run" : apply.status === "done" ? "ok" : "idle";
  const errors = jobs.filter((j) => j.status === "error").length + (lastScan?.errors ?? 0);

  return (
    <div>
      <ul className="m-0 list-none border-b border-[var(--lux-hair)] p-0">
        <Row
          name="Scanner"
          tone={scanTone}
          state={lastScan ? (lastScan.status === "completed" ? "Completed" : lastScan.status) : "No runs logged"}
          detail={lastScan ? `${ago(lastScan.at, now)} · ${lastScan.found} seen · ${lastScan.newAdded} new · ${inboxPending} in inbox` : "Run a scan from Scheduled scans"}
          href="/scheduled-scans"
        />
        <Row name="Evaluator" {...evaluator} href="/jobs" />
        <Row name="CV & letters" {...builder} href="/jobs" />
        <Row
          name="Apply fill"
          tone={applyTone}
          state={apply.status === "idle" ? "Idle" : String(apply.status)}
          detail={apply.company ? `${apply.company}${apply.n ? ` · #${apply.n}` : ""} · stops before Submit` : "Fills forms, never submits"}
          href={apply.status === "idle" ? undefined : "/apply"}
        />
        <Row name="Errors" tone={errors ? "err" : "ok"} state={errors ? `${errors} to review` : "None"} detail={errors ? "Open worker history for details" : "All quiet"} href="/jobs" />
      </ul>
    </div>
  );
}
