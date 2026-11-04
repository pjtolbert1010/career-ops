"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import type { CritterKind, ReefApplied, ReefData, ReefJob, ReefZone } from "@/lib/reef-data";
import { cn } from "@/lib/cn";
import { ApplyButton } from "@/components/apply-button";
import { GeneratePdfButton } from "@/components/generate-pdf-button";

const INK = "#0d2a3a";

const ZONES: { id: ReefZone; label: string; pill: string; pillText: string; band: string }[] = [
  { id: "reef", label: "Apply-First Reef · confirmed open, score 4.0+", pill: "#ffd166", pillText: "#4a3400", band: "#4ab3cf" },
  { id: "shelf", label: "High Tide Shelf · confirmed, needs a closer look", pill: "#bde9f3", pillText: "#07384c", band: "#2f97b8" },
  { id: "kelp", label: "Kelp Forest · not confirmed, verify first", pill: "#c8f0c4", pillText: "#123d16", band: "#1f7a9a" },
];
const ZONE_RING: Record<ReefZone, string> = { reef: "#ffd166", shelf: "#bde9f3", kelp: "#c8f0c4" };
const ZONE_NAME: Record<ReefZone, string> = { reef: "Apply-First Reef", shelf: "High Tide Shelf", kelp: "Kelp Forest" };

function Critter({ kind, color }: { kind: CritterKind; color: string }) {
  const eye = (cx: number, cy: number, r: number) => (
    <>
      <circle cx={cx} cy={cy} r={r} fill="#fff" />
      <circle cx={cx + 1} cy={cy + 1} r={r / 2} fill={INK} />
    </>
  );
  const smile = (d: string) => <path d={d} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  switch (kind) {
    case "crab":
      return (
        <svg width="96" height="80" viewBox="0 0 96 80" aria-hidden="true">
          <ellipse cx="48" cy="50" rx="30" ry="20" fill={color} />
          <circle cx="14" cy="26" r="11" fill={color} />
          <circle cx="82" cy="26" r="11" fill={color} />
          <path d="M8 20 L16 26 L6 30" fill="#2a8fb0" />
          <path d="M88 20 L80 26 L90 30" fill="#2a8fb0" />
          <line x1="40" y1="32" x2="38" y2="18" stroke={color} strokeWidth="4" />
          <line x1="56" y1="32" x2="58" y2="18" stroke={color} strokeWidth="4" />
          {eye(38, 16, 6)}
          {eye(57, 16, 6)}
          {smile("M40 56 Q48 62 56 56")}
          <line x1="24" y1="62" x2="14" y2="74" stroke={color} strokeWidth="4" />
          <line x1="72" y1="62" x2="82" y2="74" stroke={color} strokeWidth="4" />
        </svg>
      );
    case "octo":
      return (
        <svg width="90" height="92" viewBox="0 0 90 92" aria-hidden="true">
          <path d="M15 50 Q15 6 45 6 Q75 6 75 50 Z" fill={color} />
          {["M18 48 Q10 70 18 86", "M34 50 Q30 72 36 88", "M56 50 Q60 72 54 88", "M72 48 Q80 70 72 86"].map((d) => (
            <path key={d} d={d} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />
          ))}
          {eye(34, 32, 8)}
          {eye(55, 32, 8)}
          {smile("M38 44 Q45 49 52 44")}
        </svg>
      );
    case "puffer":
      return (
        <svg width="96" height="86" viewBox="0 0 96 86" aria-hidden="true">
          <g stroke={color} strokeWidth="4" strokeLinecap="round">
            <line x1="44" y1="4" x2="44" y2="14" /><line x1="16" y1="18" x2="22" y2="24" /><line x1="72" y1="18" x2="66" y2="24" />
            <line x1="6" y1="44" x2="14" y2="44" /><line x1="16" y1="70" x2="22" y2="64" /><line x1="44" y1="84" x2="44" y2="74" />
            <line x1="72" y1="70" x2="66" y2="64" />
          </g>
          <circle cx="44" cy="44" r="30" fill={color} />
          <path d="M74 44 L92 30 L92 58 Z" fill={color} />
          {eye(34, 36, 8)}
          {eye(54, 36, 8)}
          <ellipse cx="44" cy="54" rx="6" ry="4" fill={INK} />
        </svg>
      );
    case "jelly":
      return (
        <svg width="86" height="94" viewBox="0 0 86 94" aria-hidden="true">
          <path d="M8 46 Q8 6 43 6 Q78 6 78 46 Q60 40 43 46 Q26 40 8 46 Z" fill={color} />
          {["M20 46 Q14 66 22 90", "M36 48 Q42 68 34 90", "M52 48 Q46 68 54 90", "M66 46 Q72 66 64 90"].map((d) => (
            <path key={d} d={d} stroke={color} strokeWidth="4" fill="none" />
          ))}
          <circle cx="32" cy="28" r="5" fill={INK} />
          <circle cx="54" cy="28" r="5" fill={INK} />
          {smile("M36 36 Q43 41 50 36")}
        </svg>
      );
    case "star":
      return (
        <svg width="92" height="90" viewBox="0 0 92 90" aria-hidden="true">
          <path d="M46 4 L57 34 L89 34 L63 53 L73 85 L46 66 L19 85 L29 53 L3 34 L35 34 Z" fill={color} stroke={color} strokeWidth="6" strokeLinejoin="round" />
          {eye(38, 42, 6)}
          {eye(53, 42, 6)}
          {smile("M40 54 Q46 59 52 54")}
        </svg>
      );
    case "horse":
      return (
        <svg width="70" height="94" viewBox="0 0 70 94" aria-hidden="true">
          <path d="M30 10 Q52 8 50 30 Q48 44 38 50 Q52 60 44 76 Q38 90 26 86 Q34 80 34 70 Q22 62 26 46 Q18 40 22 26 Q10 26 8 20 Q16 12 30 10 Z" fill={color} />
          <path d="M50 18 L62 14 L58 24" fill={color} />
          {eye(36, 22, 5)}
        </svg>
      );
  }
}

const TRAIL = 9; // bubbles behind the fish
const LAG = 0.14; // how fast the fish closes on its spot each frame (0..1)
const REST_BEHIND = 46; // px the fish rests behind the cursor, opposite its heading
const REST_BELOW = 30; // px below the cursor, so it never sits on what you point at

/** The fish follows the mouse inside the reef, resting just behind and below
 *  the cursor, with a bubble trail. Moved with transforms on refs, not React
 *  state, so the reef does not re-render 60 times a second. */
function FishFollower({ areaRef }: { areaRef: RefObject<HTMLDivElement | null> }) {
  const fishRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGSVGElement>(null);
  const trailRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const area = areaRef.current;
    const fish = fishRef.current;
    if (!area || !fish) return;
    // Not gated on prefers-reduced-motion: the fish and trail move only with
    // the user's own pointer, and the user asked for the trail. The reef's
    // ambient motion (bob, sway, bubbles) still honors the setting in CSS.
    let tx = 0, ty = 0, x = 0, y = 0, face = 1, shown = false, raf = 0;
    const trail: { x: number; y: number }[] = [];

    const place = () => {
      const gx = tx - face * REST_BEHIND;
      const gy = ty + REST_BELOW;
      x += (gx - x) * LAG;
      y += (gy - y) * LAG;
      fish.style.transform = `translate(${x - 24}px, ${y - 19}px)`;
      if (bodyRef.current) bodyRef.current.style.transform = `scaleX(${face})`;
      // Bubbles leave from the tail and drift up as they age.
      trail.unshift({ x: x - face * 22, y });
      trail.length = Math.min(trail.length, TRAIL * 3);
      trailRefs.current.forEach((dot, i) => {
        const p = trail[i * 3];
        if (!dot) return;
        if (!p || !shown) { dot.style.opacity = "0"; return; }
        const size = Math.max(3, 10 - i);
        dot.style.width = dot.style.height = `${size}px`;
        dot.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2 - i * 3}px)`;
        dot.style.opacity = String(0.7 * (1 - i / TRAIL));
      });
    };

    const tick = () => {
      place();
      raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const r = area.getBoundingClientRect();
      const nx = e.clientX - r.left;
      const ny = e.clientY - r.top;
      if (Math.abs(nx - tx) > 2) face = nx > tx ? 1 : -1;
      if (!shown) { x = nx - face * REST_BEHIND; y = ny + REST_BELOW; }
      tx = nx; ty = ny;
      shown = true;
      fish.style.opacity = "1";
    };
    const onLeave = () => {
      shown = false;
      fish.style.opacity = "0";
    };

    area.addEventListener("pointermove", onMove);
    area.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      area.removeEventListener("pointermove", onMove);
      area.removeEventListener("pointerleave", onLeave);
    };
  }, [areaRef]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {Array.from({ length: TRAIL }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { trailRefs.current[i] = el; }}
          className="absolute left-0 top-0 rounded-full border-2 border-white/80"
          style={{ opacity: 0 }}
        />
      ))}
      <div ref={fishRef} className="absolute left-0 top-0 h-[38px] w-12 opacity-0 transition-opacity duration-300">
        <Fish bodyRef={bodyRef} />
      </div>
    </div>
  );
}

function Fish({ bodyRef }: { bodyRef: RefObject<SVGSVGElement | null> }) {
  return (
    <div>
      <svg ref={bodyRef} width="48" height="38" viewBox="0 0 64 50" aria-hidden="true" style={{ transition: "transform .2s" }}>
        <path d="M10 25 L0 10 L0 40 Z" fill="#ff8a3d" />
        <ellipse cx="34" cy="25" rx="24" ry="17" fill="#ff8a3d" />
        <path d="M28 8 Q34 0 42 9" fill="#ffb37a" />
        <circle cx="46" cy="20" r="7" fill="#fff" />
        <circle cx="48" cy="20" r="3.5" fill={INK} />
        <path d="M48 31 Q53 33 56 29" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <rect x="18" y="16" width="6" height="18" rx="3" fill="#fff" opacity=".6" />
      </svg>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-[11px] font-extrabold uppercase tracking-wide text-[#4b6470]", className)}>{children}</span>;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-[#e9f6f7] p-2.5">
      <Label>{label}</Label>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}

function JobDetail({ job, onClose }: { job: ReefJob; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full px-2.5 py-1 text-xs font-extrabold" style={{ background: ZONE_RING[job.zone] }}>
          {ZONE_NAME[job.zone]}
        </span>
        <button onClick={onClose} className="h-11 min-w-11 rounded-xl bg-[#f0e6d2] px-3 text-sm font-extrabold hover:bg-[#e6d9bf] focus-visible:outline-3 focus-visible:outline-[#0b5d7a]">
          Back
        </button>
      </div>
      <h2 className="reef-display text-2xl font-bold leading-tight">{job.title}</h2>
      <div className="text-[15px] font-bold text-[#2c4a58]">{job.employer}</div>
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-[13px] font-extrabold"><span>Fit</span><span>{job.fit}/10</span></div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#f0e6d2]">
          <div className="h-2.5 rounded-full bg-[#0b8fb3]" style={{ width: `${job.fit * 10}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="Salary" value={job.salary} />
        <Tile label="Posted" value={job.posted} />
      </div>
      <Tile label="Where" value={job.location} />
      <div className="flex flex-col gap-1">
        <Label>Why it fits</Label>
        <span className="text-sm leading-relaxed">{job.note}</span>
      </div>
      {job.nextAction && (
        <div className="flex flex-col gap-1">
          <Label>Next step</Label>
          <span className="text-sm leading-relaxed">{job.nextAction}</span>
        </div>
      )}
      <div className="flex flex-col gap-1 rounded-xl bg-[#fff1cc] px-3 py-2.5">
        <Label className="text-[#5c4300]">Verification</Label>
        <span className="text-[13px] leading-snug text-[#3d2d00]">{job.verify}</span>
      </div>
      <div className="flex flex-col gap-2">
        <ApplyButton large n={job.n} url={job.url || undefined} company={job.employer} pdfReady={job.pdfReady} />
        <p className="text-center text-xs text-[#4b6470]">Opens the form filled with your tailored CV and saved answers. You review and press Submit yourself.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <GeneratePdfButton n={job.n} company={job.employer} pdfReady={job.pdfReady} />
      </div>
      {job.url ? (
        <a href={job.url} target="_blank" rel="noopener noreferrer" className="reef-display flex min-h-11 items-center justify-center rounded-2xl border-2 border-[#0b5d7a] text-[15px] font-semibold text-[#0b5d7a] no-underline hover:bg-[#e9f6f7]">
          Open posting
        </a>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-[#b9a98a] p-3 text-[13px] font-bold text-[#5a4a2a]">No posting URL on file. Check the report.</div>
      )}
      {job.reportHref && (
        <Link href={job.reportHref} className="text-center text-sm font-bold text-[#0b5d7a] hover:text-[#063f54]">
          Read the full report
        </Link>
      )}
    </div>
  );
}

function TideReport({ data }: { data: ReefData }) {
  const top = data.jobs.filter((j) => j.zone === "reef").slice(0, 2);
  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="reef-display text-2xl font-bold">Today&apos;s tide report</h2>
      <div className="grid grid-cols-3 gap-2">
        {([["Confirmed", data.counts.confirmed], ["To verify", data.counts.toVerify], ["Applied", data.counts.applied]] as const).map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-xl bg-[#e9f6f7] p-2.5">
            <span className="reef-display text-[26px] font-bold tabular-nums">{v}</span>
            <Label>{k}</Label>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1 rounded-2xl bg-[#ffd166] p-3">
        <Label className="text-[#4a3400]">Apply this week</Label>
        <span className="text-sm font-bold leading-snug text-[#2e2100]">
          {top.length ? top.map((j) => `${j.employer} ${j.title} (fit ${j.fit})`).join(" and ") : "Nothing on the Apply-First Reef yet."}
        </span>
      </div>
      {data.shallows.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label>The shallows: top pay under {data.targetLabel || "target"}</Label>
          {data.shallows.map((s) => (
            <div key={s.what} className="flex justify-between gap-2 border-b border-[#eadfc8] py-1 text-xs leading-snug">
              <span>{s.what}</span>
              <span className="whitespace-nowrap font-extrabold">{s.pay}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NET_TONE: Record<string, string> = {
  Applied: "#ffd166",
  Responded: "#bde9f3",
  Assessment: "#bde9f3",
  Interview: "#c8f0c4",
  Offer: "#ff8a3d",
};

/** Left column: everything already applied to. These never show on the reef. */
function NetColumn({ applied }: { applied: ReefApplied[] }) {
  return (
    <aside aria-label="Applied jobs" className="order-1 w-full shrink-0 bg-[#08384c] p-5 text-[#e6f6f9] xl:sticky xl:top-0 xl:max-h-screen xl:w-[250px] xl:overflow-y-auto">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="reef-display text-xl font-bold">In the net</h2>
        <span className="reef-display text-2xl font-bold tabular-nums text-[#ffd166]">{applied.length}</span>
      </div>
      <p className="mt-1 text-xs font-bold text-[#a6c6d1]">Applied. Kept off the reef so you never apply twice.</p>
      {applied.length === 0 ? (
        <p className="mt-4 text-sm text-[#a6c6d1]">No applications yet.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:flex xl:flex-col">
          {applied.map((a) => (
            <li key={a.n} className="rounded-xl bg-white/[0.07] p-3 ring-1 ring-white/10">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[13px] font-extrabold leading-tight">{a.company}</span>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#0d2a3a]" style={{ background: NET_TONE[a.status] ?? "#ffd166" }}>
                  {a.status}
                </span>
              </div>
              <div className="mt-0.5 text-xs leading-snug text-[#cfe6ec]">{a.role}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] font-bold text-[#a6c6d1]">
                <span className="tabular-nums">{a.when}</span>
                <span className="flex gap-2">
                  {a.reportHref && <Link href={a.reportHref} className="!text-[#7fd3e6] hover:underline">Report</Link>}
                  {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="!text-[#7fd3e6] hover:underline">Posting</a>}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

export function ReefWorld({ data }: { data: ReefData }) {
  const worldRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [sel, setSel] = useState<string | null>(null);
  const selected = data.jobs.find((j) => j.id === sel) ?? null;
  const pick = (id: string) => {
    setSel(id);
    // Under xl the panel sits below the reef: bring the details into view.
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  return (
    <div className="reef-root mx-auto my-6 flex w-full max-w-[1640px] flex-col overflow-hidden rounded-[18px] bg-[#e9f6f7] text-[#0d2a3a] xl:flex-row">
      <NetColumn applied={data.applied} />

      {/* WORLD */}
      <div ref={worldRef} className="relative order-2 min-h-[800px] min-w-0 flex-1 overflow-hidden bg-[#2a8fb0] pb-32">
        <div className="absolute inset-x-0 top-0 h-24 bg-[#7fd3e6]" />
        <div className="absolute -left-10 -right-10 bottom-0 h-28 rounded-t-[50%] bg-[#e8cf95]" />
        {[{ l: "7%", s: 12, d: "9s", w: "0s" }, { l: "42%", s: 8, d: "7s", w: "2s" }, { l: "71%", s: 14, d: "11s", w: "1s" }, { l: "93%", s: 10, d: "8s", w: "4s" }].map((b) => (
          <div key={b.l} className="reef-bubble" style={{ left: b.l, bottom: 20, width: b.s, height: b.s, animationDuration: b.d, animationDelay: b.w }} />
        ))}
        {[{ l: 14, h: 170, c: "#2f8a4e", w: 18 }, { l: 36, h: 130, c: "#3ea35e", w: 14 }].map((k) => (
          <div key={k.l} className="reef-sway absolute bottom-6 rounded-xl" style={{ left: k.l, width: k.w, height: k.h, background: k.c }} />
        ))}
        <div className="reef-sway absolute bottom-6 right-5 h-40 w-[18px] rounded-xl bg-[#2f8a4e]" />

        <div className="relative z-10 flex flex-col gap-0.5 px-7 pt-4">
          <h1 className="reef-display text-[32px] font-bold text-[#08384c]">Reef Watch</h1>
          <p className="text-sm font-bold text-[#0b4a63]">
            Jobs you haven&apos;t applied to yet · click one to see the details and apply
          </p>
        </div>

        {ZONES.map((z) => {
          const jobs = data.jobs.filter((j) => j.zone === z.id);
          return (
            <section key={z.id} className="relative mt-4 px-7 py-4" style={{ background: z.band }} aria-label={z.label}>
              <span className="reef-display inline-block rounded-full px-3.5 py-1.5 text-[15px] font-semibold" style={{ background: z.pill, color: z.pillText }}>
                {z.label}
              </span>
              {jobs.length === 0 ? (
                <p className="mt-3 text-sm font-bold text-white/80">Nobody lives here yet.</p>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 xl:grid-cols-4">
                  {jobs.map((j, i) => {
                    const isSel = j.id === sel;
                    return (
                      <button
                        key={j.id}
                        onClick={() => pick(j.id)}
                        aria-label={`${j.title} at ${j.employer}, fit ${j.fit} of 10`}
                        aria-pressed={isSel}
                        className="reef-hut flex w-full flex-col items-center gap-1 rounded-xl border-0 bg-transparent p-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-white"
                      >
                        <div className="reef-bob flex size-24 items-center justify-center" style={{ animationDelay: `${(i * 0.37).toFixed(2)}s` }}>
                          <Critter kind={j.kind} color={j.color} />
                        </div>
                        <div
                          className="flex w-full max-w-[160px] flex-col gap-px rounded-xl border-[3px] px-2 py-1.5 text-center"
                          style={{ background: isSel ? "#fff1e3" : "#fff", borderColor: isSel ? "#ff8a3d" : ZONE_RING[j.zone] }}
                        >
                          <span className="reef-display line-clamp-2 text-[13px] font-semibold leading-tight">{j.employer}</span>
                          <span className="line-clamp-2 text-[11px] font-bold leading-tight text-[#2c4a58]">{j.title}</span>
                          <span className="text-[11px] font-extrabold text-[#0b5d7a]">Fit {j.fit}/10</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        <FishFollower areaRef={worldRef} />
      </div>

      {/* PANEL */}
      <aside ref={panelRef} className="order-3 w-full shrink-0 bg-[#fffaf0] p-6 xl:sticky xl:top-0 xl:max-h-screen xl:w-[360px] xl:overflow-y-auto">
        {selected ? <JobDetail job={selected} onClose={() => setSel(null)} /> : <TideReport data={data} />}
      </aside>
    </div>
  );
}
