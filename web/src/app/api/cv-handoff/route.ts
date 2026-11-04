import fs from "node:fs";
import path from "node:path";
import { exportCore } from "@/lib/cv-export";
import { careerOpsRoot, findApplication } from "@/lib/career-ops";
import { HANDOFF_KINDS, HANDOFF_MAX_USES, mintHandoff } from "@/lib/cv-handoff.mjs";
import { handoffName, tailoredDocFor, type DocKind } from "@/lib/apply/docs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MISSING: Record<DocKind, string> = {
  cv: "no tailored CV for this pipeline record",
  soq: "no Statement of Qualifications for this pipeline record",
  cover: "no tailored cover letter for this pipeline record",
};

// Mint a short-lived link to one pipeline record's tailored document, for
// Claude in Chrome to attach to that job's application page (see
// lib/cv-handoff.mjs). Same-origin only: the origin guard in proxy.ts refuses
// this POST from any other site, so only a script running on the dashboard can
// mint a link.
//
// Body: {"id": "<tracker row number>", "kind": "cv" | "soq" | "cover"}  (kind defaults to "cv")
//   → {id, kind, name, company, title, url, localFile, expiresAt, maxUses}
export async function POST(req: Request) {
  const body = await readJsonObject<{ id?: unknown; kind?: unknown }>(req);
  if (!body) return Response.json({ error: 'body must be JSON like {"id": "23"}' }, { status: 400 });
  const raw = String(body.id ?? "").trim();
  if (!/^\d+$/.test(raw)) return Response.json({ error: "id must be a pipeline record number" }, { status: 400 });
  const id = String(parseInt(raw, 10));
  const kind = (body.kind === undefined ? "cv" : String(body.kind)) as DocKind;
  if (!HANDOFF_KINDS.includes(kind)) return Response.json({ error: 'kind must be "cv", "soq" or "cover"' }, { status: 400 });

  const pdf = await tailoredDocFor(kind, id);
  if (!pdf) return Response.json({ error: MISSING[kind], kind }, { status: 404 });
  const app = findApplication(id);
  let name = handoffName(kind, id, app?.company ?? "", app?.role ?? "", pdf);
  // The same document on disk, for the user to pick by hand when a site blocks
  // the attach: the CV in the Tailored-CVs export folder, the SOQ or cover
  // letter in output/. Empty when the CV has not been exported yet.
  let localFile = kind === "cv" ? "" : pdf;
  if (kind === "cv") {
    const core = await exportCore();
    if (app) name = core.exportFileName(id, app.company, app.role);
    try {
      const candidate = path.join(core.exportDir(careerOpsRoot()), name);
      if (fs.statSync(candidate).isFile()) localFile = candidate;
    } catch {
      localFile = "";
    }
  }

  const { token, expiresAt } = mintHandoff(id, { kind });
  const { protocol, host } = new URL(req.url);
  return Response.json(
    {
      id,
      kind,
      name,
      company: app?.company ?? "",
      title: app?.role ?? "",
      url: `${protocol}//${req.headers.get("host") || host}/api/cv-handoff/${token}`,
      localFile,
      expiresAt: new Date(expiresAt).toISOString(),
      maxUses: HANDOFF_MAX_USES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
