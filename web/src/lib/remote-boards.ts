import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { openSigninAlerts } from "@/lib/signin-alerts";

// Remote-only job boards on Reef Watch: per-source health, last scan and
// counts, plus the scored pipeline rows each board found. Read-only; every
// number comes from files the scanner already writes:
//   data/portal-health.tsv  (one row per source per scan: reachable | empty |
//                            rate_limited | auth | network | server | unknown)
//   data/scan-history.tsv   (portal column = "{provider}-api")
//   data/pipeline.md        (pending rows, with rank: X/5 — reason)
//   data/signin-alerts.json (open "Needs sign-in" alerts, lib/signin-alerts)

export type SourceHealth = "OK" | "Rate-limited" | "Needs sign-in" | "Error" | "Off" | "Not scanned";

export type RemoteSource = {
  id: string;
  name: string;
  host: string;
  kind: "feed" | "session";
  enabled: boolean;
  health: SourceHealth;
  detail: string;
  lastScan: string | null;
  added: number;
  pending: number;
  loginUrl?: string;
};

export type RemoteJob = {
  url: string;
  source: string;
  company: string;
  title: string;
  location: string;
  salary: string;
  posted: string;
  rank: number | null;
  reason: string;
  salaryUnknown: boolean;
};

type SourceDef = { id: string; name: string; host: string; portal: string; kind: "feed" | "session"; loginUrl?: string };

export const REMOTE_SOURCES: SourceDef[] = [
  { id: "remoteok", name: "Remote OK", host: "remoteok.com", portal: "remoteok-api", kind: "feed" },
  { id: "remotive", name: "Remotive", host: "remotive.com", portal: "remotive-api", kind: "feed" },
  { id: "weworkremotely", name: "We Work Remotely", host: "weworkremotely.com", portal: "weworkremotely-api", kind: "feed" },
  { id: "remoteco", name: "Remote.co", host: "remote.co", portal: "remoteco-api", kind: "feed" },
  {
    id: "remotejobsfinder",
    name: "Remote Jobs Finder",
    host: "remotejobsfinder.co",
    portal: "remotejobsfinder-session",
    kind: "session",
    loginUrl: "https://remotejobsfinder.co/",
  },
];

function readText(rel: string): string {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return "";
  }
}

/** enabled: per job_boards entry name in portals.yml (default true when listed). */
function enabledBoards(): Map<string, boolean> {
  const text = readText("portals.yml");
  const out = new Map<string, boolean>();
  const re = /^ {2}- name: "?([^"\n]+?)"?\s*\n((?: {4}.*\n|\s*\n)*)/gm;
  for (const m of text.matchAll(re)) {
    const body = m[2] ?? "";
    const off = /^ {4}enabled:\s*false\b/m.test(body);
    out.set(m[1].trim(), !off);
  }
  return out;
}

function lastHealth(): Map<string, { at: string; status: string }> {
  const out = new Map<string, { at: string; status: string }>();
  for (const line of readText("data/portal-health.tsv").split("\n").slice(1)) {
    const [at, company, status] = line.split("\t");
    if (at && company && status) out.set(company.trim(), { at: at.trim(), status: status.trim() });
  }
  return out;
}

function addedCounts(): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of readText("data/scan-history.tsv").split("\n").slice(1)) {
    const cells = line.split("\t");
    if (cells[5] !== "added") continue;
    const portal = cells[2] ?? "";
    out.set(portal, (out.get(portal) ?? 0) + 1);
  }
  return out;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Pending pipeline rows from the remote boards, ranked first. */
export function readRemoteJobs(): RemoteJob[] {
  const jobs: RemoteJob[] = [];
  for (const raw of readText("data/pipeline.md").split("\n")) {
    if (!raw.startsWith("- [ ] ")) continue;
    const cells = raw.slice(6).split(" | ").map((c) => c.trim());
    const url = cells[0] ?? "";
    const host = hostOf(url);
    const src = REMOTE_SOURCES.find((s) => host === s.host || host.endsWith(`.${s.host}`));
    if (!src) continue;
    const labeled = (label: string) => cells.find((c) => c.startsWith(`${label}: `))?.slice(label.length + 2) ?? "";
    const positional = cells.slice(3).filter((c) => !/^(posted|rank|note|trust|yrs): /.test(c));
    const rankCell = labeled("rank");
    const m = rankCell.match(/^([\d.]+)\/5\s*—\s*(.*)$/);
    const note = labeled("note");
    jobs.push({
      url,
      source: src.name,
      company: cells[1] ?? "",
      title: cells[2] ?? "",
      location: positional[0] ?? "",
      salary: positional[1] ?? "",
      posted: labeled("posted"),
      rank: m ? Number(m[1]) : null,
      reason: m ? m[2] : "",
      salaryUnknown: /salary unknown/i.test(note) || !positional[1],
    });
  }
  return jobs.sort((a, b) => (b.rank ?? -1) - (a.rank ?? -1));
}

function healthOf(status: string | undefined): { health: SourceHealth; detail: string } {
  switch (status) {
    case undefined:
      return { health: "Not scanned", detail: "No scan has read this board yet." };
    case "reachable":
      return { health: "OK", detail: "Read cleanly on the last scan." };
    case "empty":
      return { health: "OK", detail: "Answered, but listed no postings." };
    case "rate_limited":
      return { health: "Rate-limited", detail: "The board asked the scanner to slow down (HTTP 429). It retries next scan." };
    case "auth":
      return { health: "Error", detail: "The board refused the request (HTTP 401/403)." };
    case "network":
      return { health: "Error", detail: "Could not connect. The site may block automated readers." };
    default:
      return { health: "Error", detail: `Last scan failed (${status}).` };
  }
}

export function readRemoteSources(jobs: RemoteJob[] = readRemoteJobs()): RemoteSource[] {
  const enabled = enabledBoards();
  const health = lastHealth();
  const added = addedCounts();
  const alerts = openSigninAlerts();
  return REMOTE_SOURCES.map((s) => {
    const alert = alerts.find((a) => a.source === s.id || hostOf(a.url) === s.host);
    const pending = jobs.filter((j) => j.source === s.name).length;
    if (s.kind === "session") {
      return {
        id: s.id,
        name: s.name,
        host: s.host,
        kind: s.kind,
        enabled: true,
        health: alert || !added.get(s.portal) ? "Needs sign-in" : "OK",
        detail: alert
          ? `Sign-in needed: ${alert.reason}`
          : added.get(s.portal)
            ? "Captured from your signed-in Chrome."
            : "Runs only through your signed-in Chrome. Open the site, sign in, then press Capture in the career-ops extension.",
        lastScan: null,
        added: added.get(s.portal) ?? 0,
        pending,
        loginUrl: s.loginUrl,
      } satisfies RemoteSource;
    }
    const on = enabled.get(s.name);
    const h = health.get(s.name);
    const { health: hv, detail } = on === false ? { health: "Off" as SourceHealth, detail: "Turned off in portals.yml." } : on === undefined ? { health: "Off" as SourceHealth, detail: "Not listed in portals.yml job_boards." } : healthOf(h?.status);
    return {
      id: s.id,
      name: s.name,
      host: s.host,
      kind: s.kind,
      enabled: on === true,
      health: alert ? "Needs sign-in" : hv,
      detail: alert ? `Sign-in needed: ${alert.reason}` : detail,
      lastScan: h?.at ?? null,
      added: added.get(s.portal) ?? 0,
      pending,
    } satisfies RemoteSource;
  });
}
