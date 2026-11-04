import fs from "node:fs";
import * as yaml from "js-yaml";
import { careerOpsRoot, readApplications, readLinkedReport, type Application } from "@/lib/career-ops";
import { getProfilePath } from "@/lib/core/profile-path.mjs";
import { canonicalizeStatus } from "@/lib/core/states";
import { parseReport, scoreNum } from "@/lib/format";
import { readMachineSummary } from "@/lib/machine-summary.mjs";
import { resolvePostingUrl } from "@/lib/posting-url.mjs";

// Reef Watch: a read-only view over the tracker and its linked reports. Every
// fact shown comes from those files; nothing here writes.

export type ReefZone = "reef" | "shelf" | "kelp";
export type CritterKind = "crab" | "octo" | "puffer" | "jelly" | "star" | "horse";

export type ReefJob = {
  id: string;
  /** Tracker row number, the key Apply and CV generation use. */
  n: string;
  /** Tracker PDF column is ✅: a tailored CV exists for this row. */
  pdfReady: boolean;
  zone: ReefZone;
  kind: CritterKind;
  critter: string;
  color: string;
  title: string;
  employer: string;
  short: string;
  fit: number;
  salary: string;
  posted: string;
  location: string;
  note: string;
  verify: string;
  nextAction: string;
  url: string;
  reportHref: string;
};

export type ReefData = {
  jobs: ReefJob[];
  applied: { what: string; when: string; status: string }[];
  shallows: { what: string; pay: string }[];
  targetLabel: string;
  /** Candidate's first name from config/profile.yml, for the fish. */
  swimmer: string;
  counts: { confirmed: number; toVerify: number; applied: number };
};

const KINDS: CritterKind[] = ["crab", "octo", "puffer", "jelly", "star", "horse"];
const COLORS = ["#ef5b4c", "#9b6bd6", "#f2b134", "#f48fb1", "#ff9e5e", "#ffb37a", "#e0703a", "#5c8ee6", "#b8a0ff", "#7ed6a8", "#ffd166"];
const FIRST = ["Captain", "Inky", "Professor", "Glow", "Civic", "Tempo", "Admiral", "Tentacle", "Drift", "Bramble", "Sandy", "Coral", "Bubbles", "Marina", "Finn", "Pearl"];
const LAST: Record<CritterKind, string> = { crab: "Pinch", octo: "Ledger", puffer: "Puff", jelly: "Drifter", star: "Starla", horse: "the Seahorse" };

const IN_THE_NET = new Set(["Applied", "Responded", "Assessment", "Interview", "Offer"]);
const MIN_SCORE = 3.0;
const APPLY_SCORE = 4.0;

/** Stable small hash so a row keeps its critter between reloads. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function field(fields: { label: string; value: string }[], label: string): string {
  return fields.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value ?? "";
}

function yamlScalar(report: string, key: string): string {
  const m = report.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m"));
  return m?.[1]?.trim() ?? "";
}

/** Top of an advertised range as annual dollars, or null when unreadable. */
export function annualTop(comp: string): number | null {
  const nums = [...comp.matchAll(/\$\s*([\d,]+(?:\.\d+)?)\s*([kK])?/g)].map((m) => parseFloat(m[1].replace(/,/g, "")) * (m[2] ? 1000 : 1));
  if (!nums.length) return null;
  const top = Math.max(...nums);
  if (/per\s+month|monthly|\/\s*mo/i.test(comp)) return top * 12;
  if (/per\s+hour|hourly|\/\s*hr/i.test(comp)) return top * 2080;
  return top;
}

function money(n: number): string {
  return `$${Math.round(n / 1000)}K`;
}

function readProfile(): { target: number | null; label: string; swimmer: string } {
  try {
    const raw = yaml.load(fs.readFileSync(getProfilePath(careerOpsRoot()), "utf8")) as {
      compensation?: { target_range?: unknown };
      candidate?: { full_name?: unknown };
    } | null;
    const label = String(raw?.compensation?.target_range ?? "").trim();
    const swimmer = String(raw?.candidate?.full_name ?? "").trim().split(/\s+/)[0] ?? "";
    return { target: label ? annualTop(label) : null, label, swimmer };
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return { target: null, label: "", swimmer: "" };
    throw err;
  }
}

function zoneFor(score: number, verification: string, legitimacy: string): ReefZone {
  const v = verification.toLowerCase();
  const confirmed = v ? v.startsWith("confirmed") : /verified active|high confidence/i.test(legitimacy);
  if (!confirmed || /unconfirmed/.test(v)) return "kelp";
  return score >= APPLY_SCORE ? "reef" : "shelf";
}

function toJob(app: Application, report: string | null, target: number | null, shallows: ReefData["shallows"]): ReefJob | null {
  const score = scoreNum(app.score);
  if (!Number.isFinite(score) || score < MIN_SCORE) return null;
  const meta = report ? parseReport(report) : { fields: [], legitimacy: null };
  const summary = report ? readMachineSummary(report) : null;
  const comp = report ? yamlScalar(report, "advertised_comp") : "";
  const top = comp ? annualTop(comp) : null;
  if (target && top && top < target) shallows.push({ what: `${app.company} · ${app.role}`, pay: `up to ${money(top)}` });

  const h = hash(`${app.n}|${app.company}|${app.role}`);
  const kind = KINDS[h % KINDS.length];
  const verification = field(meta.fields, "Verification");
  const legitimacy = meta.legitimacy ?? "";
  const strengths = summary?.strengths ?? [];
  const gaps = summary?.softGaps ?? [];
  const note = [strengths.length ? `Strengths: ${strengths.join("; ")}.` : "", gaps.length ? `Gaps: ${gaps.join("; ")}.` : ""].filter(Boolean).join(" ") || app.notes;
  const reportNum = app.report.match(/reports\/(\d+)-/)?.[1] ?? "";

  return {
    id: app.n,
    n: app.n,
    pdfReady: app.pdf.includes("✅"),
    zone: zoneFor(score, verification, legitimacy),
    kind,
    critter: `${FIRST[(h >>> 8) % FIRST.length]} ${LAST[kind]}`,
    color: COLORS[(h >>> 16) % COLORS.length],
    title: app.role,
    employer: app.company,
    short: app.company.length > 22 ? `${app.company.slice(0, 21)}…` : app.company,
    fit: Math.round(score * 2),
    salary: comp || "Not stated",
    posted: `Evaluated ${app.date}`,
    location: app.location || field(meta.fields, "Location") || "See posting",
    note,
    verify: [verification || "Not recorded", legitimacy && `Legitimacy: ${legitimacy}`].filter(Boolean).join(" · "),
    nextAction: report ? yamlScalar(report, "next_action") : "",
    url: resolvePostingUrl(app.url, field(meta.fields, "URL")),
    reportHref: reportNum ? `/pipeline/${reportNum}` : "",
  };
}

const ZONE_ORDER: Record<ReefZone, number> = { reef: 0, shelf: 1, kelp: 2 };

export function readReefData(): ReefData {
  const apps = readApplications();
  const { target, label, swimmer } = readProfile();
  const jobs: ReefJob[] = [];
  const applied: ReefData["applied"] = [];
  const shallows: ReefData["shallows"] = [];

  for (const app of apps) {
    const status = canonicalizeStatus(app.status) ?? app.status.trim();
    if (IN_THE_NET.has(status)) {
      applied.push({ what: `${app.company} · ${app.role}`, when: app.date, status });
      continue;
    }
    if (status !== "Evaluated") continue;
    const job = toJob(app, readLinkedReport(app), target, shallows);
    if (job) jobs.push(job);
  }

  jobs.sort((a, b) => ZONE_ORDER[a.zone] - ZONE_ORDER[b.zone] || b.fit - a.fit);
  return {
    jobs,
    applied,
    shallows: shallows.slice(0, 8),
    targetLabel: label,
    swimmer: swimmer || "You",
    counts: {
      confirmed: jobs.filter((j) => j.zone !== "kelp").length,
      toVerify: jobs.filter((j) => j.zone === "kelp").length,
      applied: applied.length,
    },
  };
}
