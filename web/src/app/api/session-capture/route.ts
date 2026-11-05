import fs from "node:fs";
import { pathToFileURL } from "node:url";
import * as yaml from "js-yaml";
import { readJsonObject } from "@/lib/json-body";
import { careerOpsRoot, portalsConfigPath, rootScript } from "@/lib/career-ops";
import { REMOTE_SOURCES } from "@/lib/remote-boards";
import { resolveSigninAlert } from "@/lib/signin-alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Session sources: boards that show listings only to a signed-in member
// (Remote Jobs Finder). Nothing here logs in or scrapes around a login. The
// user opens the board in their own Chrome, signs in themselves, and presses
// Capture in the career-ops extension; the extension sends the listings that
// page already shows, and this route runs them through the same title filter
// and remote-scope rule the scanner uses, dedups against scan history and the
// pipeline, then appends the new ones to data/pipeline.md.
//
// Body: { source: "remotejobsfinder", pageUrl, jobs: [{ title, company, url, location?, salary? }] }

const MAX_JOBS = 200;

type Captured = { title: string; company: string; url: string; location: string };

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f|]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export async function POST(req: Request) {
  const body = await readJsonObject<{ source?: unknown; pageUrl?: unknown; jobs?: unknown }>(req);
  if (!body) return Response.json({ error: "body must be a JSON object" }, { status: 400 });
  const source = REMOTE_SOURCES.find((s) => s.kind === "session" && s.id === body.source);
  if (!source) return Response.json({ error: "unknown session source" }, { status: 400 });
  if (!Array.isArray(body.jobs)) return Response.json({ error: "jobs must be an array" }, { status: 400 });

  const jobs: Captured[] = [];
  for (const j of body.jobs.slice(0, MAX_JOBS) as Record<string, unknown>[]) {
    // Captured rows may link out to the employer's ATS; keep any http(s) URL.
    const url = str(j?.url, 2000);
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
    } catch {
      continue;
    }
    const title = str(j?.title, 200);
    if (!title) continue;
    jobs.push({ title, url, company: str(j?.company, 120), location: str(j?.location, 160) });
  }

  const root = careerOpsRoot();
  const imp = (name: string) => import(/* webpackIgnore: true */ pathToFileURL(rootScript(name)).href);
  const [{ buildTitleFilter }, scan, scope] = await Promise.all([
    imp("title-keywords"),
    imp("scan"),
    import(/* webpackIgnore: true */ pathToFileURL(rootScript("providers/_remote-scope")).href),
  ]);

  let config: Record<string, unknown> = {};
  try {
    config = (yaml.load(fs.readFileSync(portalsConfigPath(root), "utf8")) as Record<string, unknown>) ?? {};
  } catch {
    /* no portals.yml: no title filter */
  }
  const titleOk = buildTitleFilter(config.title_filter);
  const allow = new Set(((config.remote_scope_filter as { allow?: string[] })?.allow ?? ["us", "worldwide", "unknown"]).map((s) => String(s).toLowerCase()));

  let known = "";
  try {
    known += fs.readFileSync(`${root}/data/scan-history.tsv`, "utf8");
  } catch {}
  try {
    known += fs.readFileSync(`${root}/data/pipeline.md`, "utf8");
  } catch {}
  const seen = new Set<string>();
  for (const m of known.matchAll(/https?:\/\/[^\s|\t)]+/g)) seen.add(scan.normalizeUrlForDedup(m[0]));

  const counts = { received: jobs.length, title: 0, scope: 0, dupes: 0, added: 0 };
  const offers = [];
  for (const j of jobs) {
    if (!titleOk(j.title)) {
      counts.title++;
      continue;
    }
    const remoteScope = scope.classifyRemoteScope({ location: j.location, title: j.title });
    if (!allow.has(remoteScope)) {
      counts.scope++;
      continue;
    }
    const key = scan.normalizeUrlForDedup(j.url);
    if (seen.has(key)) {
      counts.dupes++;
      continue;
    }
    seen.add(key);
    offers.push({ ...j, location: j.location || "Remote", source: source.portal, note: `via ${source.name} (signed-in Chrome capture) — salary unknown` });
  }
  if (offers.length) {
    await scan.appendToPipeline(offers);
    await scan.appendToScanHistory(offers, new Date().toISOString().slice(0, 10), "added");
  }
  counts.added = offers.length;
  // A successful capture proves the session works: clear its sign-in alert.
  resolveSigninAlert({ site: source.host });
  return Response.json(counts);
}
