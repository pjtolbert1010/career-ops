"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Trash2 } from "lucide-react";

type Entry = { id: string; question: string; labels: string[]; type: string; answer: string; options?: string[]; updated: string };

// Every question the user has answered on an application form, saved by the
// career-ops Chrome extension (data/answer-bank.json). The next form that asks
// the same question is filled from here, so editing an answer changes what
// future applications get.
export function AnswerBankView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/answer-bank").then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => setError("Could not load saved questions."));
  }, []);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries
      .filter((e) => !needle || `${e.question} ${e.answer}`.toLowerCase().includes(needle))
      .slice()
      .sort((a, b) => a.question.localeCompare(b.question));
  }, [entries, q]);

  async function send(method: "PUT" | "DELETE", body: object, id: string) {
    const r = await fetch("/api/answer-bank", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Could not save.");
    setEntries(d.entries);
    setError("");
    if (method === "PUT") {
      setSaved(id);
      setTimeout(() => setSaved(""), 1500);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl tracking-tight text-landing">Saved questions</h2>
      <p className="mt-1 text-sm text-muted">
        Questions you answered on application forms. The extension saves them when you press Next, Submit or Save on a form, and fills them next time. Short answers are reused as is; essays are adapted to the new employer.
      </p>
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${entries.length} saved questions`}
        className="mt-4 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
      />
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-faint">Nothing saved yet. Apply with the extension and your answers land here.</p>
      ) : (
        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface/40">
          {shown.map((e) => {
            const value = drafts[e.id] ?? e.answer;
            const long = e.type === "textarea" || value.length > 80;
            return (
              <div key={e.id} className="p-4">
                <label htmlFor={e.id} className="block text-sm font-medium">{e.question}</label>
                <div className="mt-2 flex gap-2">
                  {e.options?.length && !long ? (
                    <select id={e.id} value={value} onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                      {[value, ...e.options.filter((o) => o !== value)].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : long ? (
                    <textarea id={e.id} rows={4} value={value} onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50" />
                  ) : (
                    <input id={e.id} value={value} onChange={(ev) => setDrafts((d) => ({ ...d, [e.id]: ev.target.value }))} className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50" />
                  )}
                  <button type="button" onClick={() => send("PUT", { id: e.id, answer: value }, e.id)} className="inline-flex items-center gap-1 self-start rounded-lg bg-brand px-3 py-2 text-sm text-brand-foreground">
                    {saved === e.id && <Check className="size-4" />}Save
                  </button>
                  <button type="button" aria-label={`Delete saved answer: ${e.question}`} onClick={() => send("DELETE", { id: e.id }, e.id)} className="self-start rounded-lg border border-border px-3 py-2 text-muted hover:text-red-500">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-faint">Updated {new Date(e.updated).toLocaleDateString()}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
