"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// "Needs sign-in" banner. Shown on every dashboard page while an alert is
// open (data/signin-alerts.json, raised by the career-ops extension when a
// source or an apply flow hits a login, SSO, captcha or paywall). A new alert
// also plays a short tone (Web Audio, no file) and, once allowed, raises a
// Windows desktop notification through the browser. "Open sign-in page" opens
// that site's own page in a new tab of this browser, where the user signs in
// themselves; "I'm signed in" clears the alert so the job can resume.
// Nothing here types, stores or reads a password.

type Alert = { id: string; site: string; url: string; loginUrl: string; reason: string; kind: string; source: string; createdAt: string };

const POLL_MS = 10_000;

function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const tone = (freq: number, at: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + 0.4);
    };
    tone(880, 0);
    tone(660, 0.3);
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch {
    /* audio blocked until the page has had a click: the banner still shows */
  }
}

function notify(a: Alert) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const n = new Notification(`Sign-in needed: ${a.site}`, { body: `${a.reason} Open Career Reef to continue.`, tag: `signin-${a.site}` });
    n.onclick = () => window.focus();
  } catch {
    /* ignore */
  }
}

export function SigninBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [perm, setPerm] = useState<string>("default");
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/signin-alerts", { cache: "no-store" });
      if (!r.ok) return;
      const { alerts: list } = (await r.json()) as { alerts: Alert[] };
      const keyOf = (a: Alert) => `${a.id}:${a.createdAt}`;
      if (seen.current) {
        const fresh = list.filter((a) => !seen.current!.has(keyOf(a)));
        if (fresh.length) {
          chime();
          fresh.forEach(notify);
        }
      }
      seen.current = new Set(list.map(keyOf));
      setAlerts(list);
    } catch {
      /* dashboard restarting: try again next poll */
    }
  }, []);

  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
    load();
    const t = window.setInterval(load, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  const resolve = async (a: Alert) => {
    await fetch("/api/signin-alerts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: a.id }) }).catch(() => {});
    load();
  };

  if (!alerts.length) return null;
  return (
    <div role="alert" aria-live="assertive" className="sticky top-0 z-[60] border-b border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
      {alerts.map((a) => (
        <div key={a.id} className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-sm">
          <span className="font-semibold uppercase tracking-wide">Needs sign-in</span>
          <span className="min-w-0 flex-1">
            <strong>{a.site}</strong> — {a.reason} That job is stopped until you sign in.
          </span>
          <a href={a.loginUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-current px-3 py-1 font-medium hover:bg-amber-100 dark:hover:bg-amber-900">
            Open sign-in page
          </a>
          <button type="button" onClick={() => resolve(a)} className="rounded-full bg-amber-900 px-3 py-1 font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-100 dark:text-amber-950">
            I&apos;m signed in
          </button>
        </div>
      ))}
      {perm === "default" && (
        <div className="mx-auto max-w-6xl px-4 pb-3 text-xs">
          <button
            type="button"
            className="underline"
            onClick={async () => {
              const p = await Notification.requestPermission();
              setPerm(p);
            }}
          >
            Turn on desktop notifications for sign-in alerts
          </button>
        </div>
      )}
    </div>
  );
}
