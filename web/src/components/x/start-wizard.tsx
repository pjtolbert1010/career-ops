"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CvIngest } from "@/components/cv/cv-ingest";
import type { XData, XPrefs } from "@/lib/x-data";

const STEPS = ["Your resume", "What you want", "You're set"];

/** "$130K", "130000", "130k" → 130000; null when it does not read as a number. */
function dollars(s: string): number | null {
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*([kK])?/);
  if (!m) return null;
  return Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1));
}

// aiapply's quiz, in three steps. Step 1 reuses the dashboard's CV import
// (propose, preview, confirm). Step 2 writes only the fields you changed,
// through the merge-safe /api/profile writer. Nothing is saved until you press Save.
export function StartWizard({ prefs, resume }: { prefs: XPrefs; resume: XData["resume"] }) {
  const [step, setStep] = useState(resume.exists ? 1 : 0);
  const [roles, setRoles] = useState(prefs.roles.join("\n"));
  const [minimum, setMinimum] = useState(prefs.minimum);
  const [target, setTarget] = useState(prefs.target);
  const [remote, setRemote] = useState(prefs.remote);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const patch: Record<string, unknown> = {};
    const roleList = roles.split(/\r?\n|,/).map((r) => r.trim()).filter(Boolean);
    if (roleList.join("|") !== prefs.roles.join("|")) patch.roles = roleList;
    if (remote.trim() !== prefs.remote) patch.remote = remote.trim();
    if (minimum !== prefs.minimum || target !== prefs.target) {
      const lo = dollars(minimum);
      const hi = dollars(target);
      if (!lo || !hi) return setMsg("Write the salaries as numbers, for example 90000 and 130000.");
      patch.compMin = lo;
      patch.compMax = hi;
    }
    if (Object.keys(patch).length === 0) return setStep(2);
    setSaving(true);
    const res = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
    setSaving(false);
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      return setMsg(b.error || `Save failed (HTTP ${res.status}).`);
    }
    setMsg("");
    setStep(2);
  };

  const input = "min-h-[44px] w-full border border-[var(--lux-hair)] bg-[var(--lux-white)] px-3 text-[15px] text-[var(--lux-ink)] outline-none focus:border-[var(--lux-ink)]";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10">
      <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className="flex w-full flex-col gap-2 border-0 border-t-2 bg-transparent pt-3 text-left"
              style={{ borderColor: i <= step ? "var(--lux-ink)" : "var(--lux-hair)" }}
            >
              <span className="lux-eyebrow">Step {i + 1}</span>
              <span className="lux-serif text-[1.2rem]">{s}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="flex flex-col gap-5">
          <h2 className="lux-display m-0 text-[2rem]">Start with your resume</h2>
          <p className="lux-lede m-0">Upload a PDF or paste the text. It is turned into your base resume, and you check it before it is saved.</p>
          <CvIngest onSaved={() => setStep(1)} />
          {resume.exists && (
            <button type="button" className="lux-link self-start" onClick={() => setStep(1)}>
              <span className="lux-u">Keep my current resume ({resume.words} words)</span>
              <span className="lux-arrow" aria-hidden="true">→</span>
            </button>
          )}
        </section>
      )}

      {step === 1 && (
        <form onSubmit={save} className="flex flex-col gap-6">
          <h2 className="lux-display m-0 text-[2rem]">What are you looking for?</h2>
          {resume.exists && (
            <p className="m-0 text-sm text-[var(--lux-mute)]">
              Resume on file: {resume.words} words, updated {resume.updated}.{" "}
              <button type="button" className="underline" onClick={() => setStep(0)}>
                Replace it
              </button>
            </p>
          )}
          <label className="flex flex-col gap-2">
            <span className="lux-eyebrow">Job titles, one per line</span>
            <textarea value={roles} onChange={(e) => setRoles(e.target.value)} rows={5} className={`${input} py-2`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="lux-eyebrow">Lowest salary you would take</span>
              <input value={minimum} onChange={(e) => setMinimum(e.target.value)} className={input} />
            </label>
            <label className="flex flex-col gap-2">
              <span className="lux-eyebrow">Target salary</span>
              <input value={target} onChange={(e) => setTarget(e.target.value)} className={input} />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className="lux-eyebrow">Where you will work</span>
            <textarea value={remote} onChange={(e) => setRemote(e.target.value)} rows={2} className={`${input} py-2`} placeholder="Remote only, or hybrid near my city" />
          </label>
          <p className="m-0 text-xs text-[var(--lux-mute)]">
            Saved to config/profile.yml. Only the fields you change are written, and a backup of the old file is kept. Companies to include or avoid live in{" "}
            <Link href="/portals" className="underline">Portals</Link> and the do-not-apply list.
          </p>
          {msg && <p className="m-0 text-sm text-[#9b3b2f]" role="alert">{msg}</p>}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="lux-btn lux-btn-solid" disabled={saving}>
              {saving ? "Saving…" : "Save and continue"}
            </button>
            <button type="button" className="lux-btn" onClick={() => setStep(2)}>
              Skip, keep as is
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-6">
          <h2 className="lux-display m-0 text-[2rem]">
            You&apos;re <em>set.</em>
          </h2>
          <p className="lux-lede m-0">
            New jobs arrive from the scheduled scans, are scored against your resume, and land in Matches. The best ones get documents made and wait in the Apply queue. You open each one, check it, and press Submit yourself.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/x/jobs" className="lux-btn lux-btn-solid">See my matches</Link>
            <Link href="/x/queue" className="lux-btn">Open the apply queue</Link>
            <Link href="/explore" className="lux-btn">Search for new jobs</Link>
          </div>
          <p className="m-0 text-xs text-[var(--lux-mute)]">
            Open &amp; fill needs the career-ops Apply extension in Chrome (web/extension, loaded unpacked).
          </p>
        </section>
      )}
    </div>
  );
}
