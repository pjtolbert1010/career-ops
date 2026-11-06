import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications, readLinkedReport, readStatusLog } from "@/lib/career-ops";
import { canonicalizeStatus } from "@/lib/core/states";
import { scoreNum } from "@/lib/format";
import { readMachineSummary } from "@/lib/machine-summary.mjs";
import { readReefData, type ReefJob } from "@/lib/reef-data";

// Career ops X Ai apply: a read-only view for the /x pages, modeled on
// aiapply's one-profile, one-queue, one-button flow. Built on Reef Watch's
// readReefData() so both views agree on every job; this file only adds the
// match-card details (score out of 100, qualification checklist) and the
// tracker board. Nothing here writes.

export type Qualification = { text: string; met: "yes" | "partial" | "no" };

export type XJob = ReefJob & {
  /** Evaluation score (1-5) as a 0-100 match score, the way aiapply shows fit. */
  match: number;
  strengths: string[];
  gaps: string[];
  qualifications: Qualification[];
  /** Report number, for /api/keyword-match and the report page. */
  report: string;
  remote: boolean;
  /** Queue lane: documents still to make, or ready for Open & fill. */
  lane: "prepare" | "ready";
};

export type XBoardItem = {
  n: string;
  company: string;
  role: string;
  status: string;
  when: string;
  url: string;
  reportHref: string;
  hasCv: boolean;
};

export type XData = {
  jobs: XJob[];
  board: Record<"applied" | "process" | "offer" | "closed", XBoardItem[]>;
  stats: { matches: number; ready: number; appliedThisWeek: number; interviews: number; inbox: number };
  lastScan: { at: string; found: number; newAdded: number } | null;
  targetLabel: string;
  resume: { exists: boolean; words: number; updated: string; headline: string };
};

/** Block B ("CV Match") rows: requirement + ✅ / ⚠️ / ❌, the aiapply checklist. */
export function qualificationsFrom(report: string): Qualification[] {
  const start = report.search(/^##\s*(B\)|.*CV Match)/im);
  if (start < 0) return [];
  const rest = report.slice(start);
  const end = rest.slice(3).search(/^##\s/m);
  const block = end < 0 ? rest : rest.slice(0, end + 3);
  const rows = block.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (rows.length < 3) return [];
  const head = rows[0].split("|").map((c) => c.trim().toLowerCase());
  const reqCol = head.findIndex((c) => /requirement|qualification|criteria/.test(c));
  let matchCol = head.findIndex((c) => /^(match|status|fit|verdict|met)\b/.test(c));
  if (matchCol < 0) matchCol = head.length - 2; // last real cell (trailing "|" leaves an empty one)
  if (reqCol < 0) return [];
  const out: Qualification[] = [];
  for (const row of rows.slice(2)) {
    const cells = row.split("|").map((c) => c.trim());
    const text = (cells[reqCol] ?? "").replace(/\*\*/g, "");
    if (!text) continue;
    out.push({ text, met: classify(cells[matchCol] ?? "") });
  }
  return out;
}

/** Report wording varies (emoji or words); read it as met / partly / not met. */
function classify(cell: string): Qualification["met"] {
  const c = cell.toLowerCase();
  if (cell.includes("❌") || /\b(gap|missing|not met|no|none|lacking)\b/.test(c)) return "no";
  if (cell.includes("⚠") || /partial|likely|adjacent|confirm|transferable|some/.test(c)) return "partial";
  if (cell.includes("✅") || /strong|\bmet\b|\byes\b|exceeds|direct|match/.test(c)) return "yes";
  return "partial";
}

/** Short reports have no Block B table: use the evaluation's strengths and gaps. */
function fallbackQuals(strengths: string[], gaps: string[]): Qualification[] {
  return [...strengths.slice(0, 4).map((text) => ({ text, met: "yes" as const })), ...gaps.slice(0, 3).map((text) => ({ text, met: "no" as const }))];
}

/** Remote, not hybrid: the location, the report's work-mode line, or the tracker note says so. */
export function isRemote(location: string, notes: string, report: string): boolean {
  const mode =
    report.match(/^\|\s*(?:Work mode|Work arrangement|Remote)\s*\|([^|\n]*)/im)?.[1] ??
    report.match(/^\*\*(?:Work mode|Remote|Location):\*\*([^\n]*)/im)?.[1] ??
    "";
  for (const t of [location, mode, notes]) {
    if (/remote|telework/i.test(t)) return !/hybrid|on-?site/i.test(t);
  }
  return false;
}

function wantsCover(j: ReefJob): boolean {
  return !j.calcareers || j.needs.cover;
}

/** Every document this posting needs is saved. */
/** Reef Watch's "prepped" rule (reef-world.tsx isPrepped): tailored resume, plus the SOQ when needed. */
function isPrepped(j: ReefJob): boolean {
  const needsSoq = j.calcareers || j.needs.soq;
  return j.pdfReady && j.docs.cv && (!needsSoq || j.docs.soq);
}

export function docsComplete(j: ReefJob): boolean {
  const needsSoq = j.calcareers || j.needs.soq;
  return j.docs.cv && (!needsSoq || j.docs.soq) && (!wantsCover(j) || j.docs.cover);
}

function readResume(): XData["resume"] {
  try {
    const file = path.join(careerOpsRoot(), "cv.md");
    const text = fs.readFileSync(file, "utf8");
    // First sentence of the Summary section; else the top heading.
    const summary = text.match(/^##[^\n]*(?:summary|profile)[^\n]*\r?\n+([^\n#][^\n]*)/im)?.[1] ?? "";
    const sentence = summary.split(/(?<=\.)\s/)[0];
    const firstSentence = sentence.length > 180 ? `${sentence.slice(0, 180).replace(/\s+\S*$/, "")}…` : sentence;
    const headline = firstSentence || (text.match(/^#\s+(.+)$/m)?.[1] ?? "");
    return {
      exists: true,
      words: text.split(/\s+/).filter(Boolean).length,
      updated: fs.statSync(file).mtime.toISOString().slice(0, 10),
      headline: headline.replace(/[*_]/g, "").trim(),
    };
  } catch {
    return { exists: false, words: 0, updated: "", headline: "" };
  }
}

const PROCESS = new Set(["Responded", "Assessment", "Interview"]);

export async function readXData(): Promise<XData> {
  const reef = await readReefData();
  const apps = readApplications();
  const byN = new Map(apps.map((a) => [a.n, a]));

  const jobs: XJob[] = reef.jobs.map((j) => {
    const app = byN.get(j.n);
    const report = app ? readLinkedReport(app) : null;
    const summary = report ? readMachineSummary(report) : null;
    const score = app ? scoreNum(app.score) : j.fit / 2;
    return {
      ...j,
      match: Math.round((Number.isFinite(score) ? score : 0) * 20),
      strengths: summary?.strengths ?? [],
      gaps: summary?.softGaps ?? [],
      qualifications: (report && qualificationsFrom(report).length ? qualificationsFrom(report) : fallbackQuals(summary?.strengths ?? [], summary?.softGaps ?? [])),
      report: j.report,
      remote: isRemote(j.location, app?.notes ?? "", report ?? ""),
      // Same rule as Reef Watch "Ready for review": the tailored resume, plus the
      // SOQ when the posting needs one. A missing cover letter is flagged, not blocking.
      lane: isPrepped(j) ? "ready" : "prepare",
    };
  });
  jobs.sort((a, b) => b.match - a.match);

  // The board: every tracker row past Evaluated, newest move first.
  const enteredOn = new Map<string, string>();
  for (const row of readStatusLog()) enteredOn.set(`${row.num}|${row.to}`, row.date);
  const board: XData["board"] = { applied: [], process: [], offer: [], closed: [] };
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  for (const app of apps) {
    const status = canonicalizeStatus(app.status) ?? app.status.trim();
    const when = enteredOn.get(`${parseInt(app.n, 10)}|${status}`) ?? app.date;
    const num = app.report.match(/reports\/(\d+)-/)?.[1];
    const item: XBoardItem = {
      n: app.n,
      company: app.company,
      role: app.role,
      status,
      when,
      url: reef.applied.find((a) => a.n === app.n)?.url ?? app.url ?? "",
      reportHref: num ? `/pipeline/${num}` : "",
      hasCv: app.pdf.includes("✅"),
    };
    if (status === "Applied") board.applied.push(item);
    else if (PROCESS.has(status)) board.process.push(item);
    else if (status === "Offer" || status === "Hired") board.offer.push(item);
    else if (status === "Rejected" && when >= monthAgo) board.closed.push(item);
  }
  for (const k of Object.keys(board) as (keyof XData["board"])[]) board[k].sort((a, b) => b.when.localeCompare(a.when));

  return {
    jobs,
    board,
    stats: {
      matches: jobs.length,
      ready: jobs.filter((j) => j.lane === "ready").length,
      appliedThisWeek: reef.stats.appliedThisWeek,
      interviews: reef.stats.interviews,
      inbox: reef.stats.inboxPending,
    },
    lastScan: reef.lastScan ? { at: reef.lastScan.at, found: reef.lastScan.found, newAdded: reef.lastScan.newAdded } : null,
    targetLabel: reef.targetLabel,
    resume: readResume(),
  };
}

export type XPrefs = { roles: string[]; target: string; minimum: string; remote: string; location: string };

/** What the onboarding wizard shows as "your current answers". Read-only. */
export async function readXPrefs(): Promise<XPrefs> {
  const empty: XPrefs = { roles: [], target: "", minimum: "", remote: "", location: "" };
  try {
    const yaml = await import("js-yaml");
    const { getProfilePath } = await import("@/lib/core/profile-path.mjs");
    const raw = yaml.load(fs.readFileSync(getProfilePath(careerOpsRoot()), "utf8")) as {
      target_roles?: { primary?: unknown };
      compensation?: { target_range?: unknown; minimum?: unknown; location_flexibility?: unknown };
      candidate?: { location?: unknown };
    } | null;
    const primary = raw?.target_roles?.primary;
    return {
      roles: Array.isArray(primary) ? primary.map(String) : [],
      target: String(raw?.compensation?.target_range ?? ""),
      minimum: String(raw?.compensation?.minimum ?? ""),
      remote: String(raw?.compensation?.location_flexibility ?? ""),
      location: String(raw?.candidate?.location ?? ""),
    };
  } catch {
    return empty;
  }
}
