"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Check } from "lucide-react";
import { AnswerBankView } from "@/components/answer-bank-view";

type Entry = { value: string; labels: string[]; sensitive?: boolean };
type Answers = Record<string, Record<string, Entry>>;

export function AnswersView() {
  const [answers, setAnswers] = useState<Answers>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => { fetch("/api/answers").then((r) => r.json()).then((d) => { if (!d.error) setAnswers(d.answers); else setError(d.error); }).catch(() => setError("Could not load answers.")); }, []);
  async function save(section: string, key: string) {
    const response = await fetch("/api/answers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, key, value: drafts[`${section}.${key}`] ?? answers[section][key].value }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "Could not save answer."); return; }
    setAnswers(result.answers); setSaved(`${section}.${key}`); setError("");
    setTimeout(() => setSaved(""), 1500);
  }
  return <main className="mx-auto max-w-3xl px-6 py-10">
    <h1 className="font-display text-2xl tracking-tight text-landing">Answers</h1>
    <p className="mt-1 text-sm text-muted">Saved answers for application forms. Sensitive entries stay masked until revealed.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}
    <div className="mt-8 space-y-6">{Object.entries(answers).map(([section, entries]) => <section key={section} className="rounded-xl border border-border bg-surface/40 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">{section.replaceAll("_", " ")}</h2>
      <div className="mt-3 divide-y divide-border">{Object.entries(entries).map(([key, entry]) => {
        const id = `${section}.${key}`; const isRevealed = !entry.sensitive || revealed[id];
        return <div key={key} className="py-3 first:pt-0 last:pb-0">
          <label htmlFor={id} className="block text-sm font-medium">{key.replaceAll("_", " ")}</label>
          <div className="mt-2 flex gap-2">
            <input id={id} readOnly={!isRevealed} value={isRevealed ? (drafts[id] ?? entry.value) : "••••••••"} onChange={(e) => setDrafts((v) => ({ ...v, [id]: e.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50" />
            {entry.sensitive && <button type="button" onClick={() => setRevealed((v) => ({ ...v, [id]: !v[id] }))} aria-label={isRevealed ? "Mask value" : "Reveal value"} className="rounded-lg border border-border px-3 text-muted">{isRevealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}
            <button type="button" onClick={() => save(section, key)} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 text-sm text-brand-foreground">{saved === id && <Check className="size-4" />}Save</button>
          </div>
          <p className="mt-1 text-xs text-faint">Labels: {entry.labels.join(", ")}</p>
        </div>;
      })}</div>
    </section>)}</div>
    <AnswerBankView />
  </main>;
}
