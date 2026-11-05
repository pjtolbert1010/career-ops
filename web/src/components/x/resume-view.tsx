"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { XData, XJob } from "@/lib/x-data";
import { Eyebrow } from "@/components/lux/primitives";

type Coverage = { total: number; presentCount: number; coveragePct: number; present: string[]; thin: string[]; missing: string[] };
type Answer = { available: boolean; reason: string | null; result: Coverage | null };

const REASON: Record<string, string> = {
  "no-keywords": "This evaluation has no keyword list (older report).",
  "no-report": "No evaluation report for this job.",
  "no-script": "keyword-match.mjs is missing from this checkout.",
  failed: "The keyword check failed.",
  unparseable: "The keyword check returned no result.",
};

// aiapply's resume scanner, built on keyword-match.mjs: coverage of the job's
// keywords in your resume. Diagnostic only; it never edits the resume, and a
// missing keyword is only worth adding if it is true.
function AtsCheck({ jobs }: { jobs: XJob[] }) {
  const withReport = jobs.filter((j) => j.report);
  const [report, setReport] = useState(withReport[0]?.report ?? "");
  const [ans, setAns] = useState<Answer | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!report) return;
    let live = true;
    setLoading(true);
    fetch(`/api/keyword-match?report=${encodeURIComponent(report)}`)
      .then((r) => r.json())
      .then((a: Answer) => live && setAns(a))
      .catch(() => live && setAns({ available: false, reason: "failed", result: null }))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [report]);
  const r = ans?.result;
  return (
    <div className="flex flex-col gap-5 border border-[var(--lux-hair)] bg-[var(--lux-white)] p-6">
      <label className="flex flex-col gap-1">
        <span className="lux-eyebrow">Check your resume against</span>
        <select value={report} onChange={(e) => setReport(e.target.value)} className="min-h-[44px] border border-[var(--lux-hair)] bg-transparent px-2 text-[15px]">
          {withReport.map((j) => (
            <option key={j.id} value={j.report}>
              {j.employer} · {j.title}
            </option>
          ))}
        </select>
      </label>
      {loading && <p className="m-0 text-sm text-[var(--lux-mute)]">Checking…</p>}
      {!loading && ans && !ans.available && <p className="m-0 text-sm text-[var(--lux-mute)]">{REASON[ans.reason ?? ""] ?? "Not available."}</p>}
      {!loading && r && (
        <>
          <div className="flex items-end gap-4">
            <span className="lux-stat-num" style={{ fontSize: "3.5rem" }}>{r.coveragePct}%</span>
            <span className="pb-2 text-sm text-[var(--lux-mute)]">
              keyword coverage · {r.presentCount} of {r.total} found
            </span>
          </div>
          <div className="h-px bg-[var(--lux-hair)]">
            <div className="h-px bg-[var(--lux-ink)]" style={{ width: `${r.coveragePct}%` }} />
          </div>
          {r.present.length > 0 && <Chips label="In your resume" items={r.present} tone="ok" />}
          {r.thin.length > 0 && <Chips label="Mentioned lightly" items={r.thin} tone="thin" />}
          {r.missing.length > 0 && <Chips label="Not in your resume" items={r.missing} tone="miss" />}
          <p className="m-0 text-xs text-[var(--lux-mute)]">
            Add a missing keyword only if it is true for you. The tailored resume for this job already reorders and rephrases what you have; it never invents.
          </p>
        </>
      )}
    </div>
  );
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: "ok" | "thin" | "miss" }) {
  const sign = tone === "ok" ? "✓" : tone === "thin" ? "~" : "✗";
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>{label}</Eyebrow>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {items.map((k) => (
          <li key={k} className="lux-tag normal-case tracking-normal text-[12px] text-[var(--lux-ink)]">
            {sign} {k}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResumeView({ resume, jobs }: { resume: XData["resume"]; jobs: XJob[] }) {
  const tailored = jobs.filter((j) => j.docs.cv);
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 border border-[var(--lux-hair)] bg-[var(--lux-white)] p-6">
          <Eyebrow>Base resume</Eyebrow>
          {resume.exists ? (
            <>
              <p className="lux-serif m-0 text-[1.3rem] leading-snug">{resume.headline || "cv.md"}</p>
              <p className="m-0 text-sm text-[var(--lux-mute)]">
                {resume.words} words · updated {resume.updated}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/cv" className="lux-btn lux-btn-sm lux-btn-solid">Edit resume</Link>
                <Link href="/x/start" className="lux-btn lux-btn-sm">Replace from a file</Link>
              </div>
            </>
          ) : (
            <Link href="/x/start" className="lux-btn lux-btn-solid">Add your resume</Link>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Eyebrow>Tailored versions ({tailored.length})</Eyebrow>
          {tailored.length === 0 ? (
            <p className="m-0 text-sm text-[var(--lux-mute)]">None yet. The Apply queue makes them.</p>
          ) : (
            <ul className="m-0 list-none border-t border-[var(--lux-hair)] p-0">
              {tailored.map((j) => (
                <li key={j.id} className="flex items-center justify-between gap-4 border-b border-[var(--lux-hair)] py-3 text-sm">
                  <span>
                    {j.employer} <span className="text-[var(--lux-mute)]">· {j.title}</span>
                  </span>
                  <a href={`/api/docs/${j.n}/pdf?kind=cv`} target="_blank" rel="noreferrer" className="lux-link shrink-0">
                    <span className="lux-u">View</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Eyebrow>ATS check</Eyebrow>
        {jobs.some((j) => j.report) ? <AtsCheck jobs={jobs} /> : <p className="text-sm text-[var(--lux-mute)]">No evaluated jobs to check against yet.</p>}
      </div>
    </div>
  );
}
