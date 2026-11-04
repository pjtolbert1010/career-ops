"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/cn";

type UsageWindow = { label: string; usedPercent: number; resetsAt: string | null };
type Provider = {
  id: string;
  name: string;
  plan: string | null;
  windows: UsageWindow[];
  source: "live" | "local-log" | "none";
  note: string | null;
  observedAt: string | null;
};
type Usage = { providers?: Provider[]; window5h?: { tokens: number }; window7d?: { tokens: number } };

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
}

function tone(pct: number): string {
  if (pct >= 85) return "bg-red-400";
  if (pct >= 60) return "bg-amber-400";
  return "bg-emerald-400";
}

/** "resets in 3h 20m" / "resets in 4d" / "" — relative to now. */
function resetsIn(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `resets in ${Math.round(h / 24)}d`;
  if (h >= 1) return `resets in ${h}h ${m}m`;
  return `resets in ${m}m`;
}

function Bar({ w }: { w: UsageWindow }) {
  const reset = resetsIn(w.resetsAt);
  return (
    <div title={reset ? `${w.usedPercent}% used, ${reset}` : `${w.usedPercent}% used`}>
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>{w.label}</span>
        <span className="tabular-nums">{w.usedPercent}%</span>
      </div>
      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
        <div className={cn("h-full rounded-full transition-all", tone(w.usedPercent))} style={{ width: `${Math.max(w.usedPercent, 2)}%` }} />
      </div>
      {reset && <div className="mt-0.5 text-right text-[9px] text-faint">{reset}</div>}
    </div>
  );
}

// Real plan-limit usage for each agent CLI on this machine (/api/usage →
// lib/plan-usage.mjs). Claude falls back to raw token volume, without a
// made-up percentage, when its usage service is unavailable.
export function UsageMeter() {
  const [data, setData] = useState<Usage | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/usage")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!data?.providers?.length) return null;

  return (
    <div className="border-t border-border pt-3">
      <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">
        <Gauge className="size-3" /> Plan usage
      </div>
      <div className="space-y-3 px-1">
        {data.providers.map((p) => (
          <div key={p.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="font-semibold text-foreground">{p.name}</span>
              {p.plan && <span className="text-[10px] capitalize text-faint">{p.plan}</span>}
            </div>
            {p.windows.map((w) => (
              <Bar key={w.label} w={w} />
            ))}
            {p.windows.length > 0 && p.observedAt && Date.now() - new Date(p.observedAt).getTime() > 6 * 60_000 && (
              <div className="text-[9px] text-faint">
                as of {new Date(p.observedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            )}
            {p.windows.length === 0 && p.id === "claude" && data.window5h && data.window7d ? (
              <div className="text-[10px] text-faint" title={p.note ?? undefined}>
                Live limits unavailable. Tokens used: {fmtTokens(data.window5h.tokens)} (5h) · {fmtTokens(data.window7d.tokens)} (7d)
              </div>
            ) : p.windows.length === 0 ? (
              <div className="text-[10px] text-faint">{p.note ?? "No usage data."}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
