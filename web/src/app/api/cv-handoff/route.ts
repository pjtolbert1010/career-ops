import fs from "node:fs";
import path from "node:path";
import { exportCore, tailoredCvFor } from "@/lib/cv-export";
import { careerOpsRoot, findApplication } from "@/lib/career-ops";
import { HANDOFF_MAX_USES, mintHandoff } from "@/lib/cv-handoff.mjs";
import { readJsonObject } from "@/lib/json-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mint a short-lived link to one pipeline record's tailored CV, for Claude in
// Chrome to attach to that job's application page (see lib/cv-handoff.mjs).
// Same-origin only: the origin guard in proxy.ts refuses this POST from any
// other site, so only a script running on the dashboard can mint a link.
//
// Body: {"id": "<tracker row number>"} → {id, name, company, title, url, localFile, expiresAt, maxUses}
export async function POST(req: Request) {
  const body = await readJsonObject<{ id?: unknown }>(req);
  if (!body) return Response.json({ error: 'body must be JSON like {"id": "23"}' }, { status: 400 });
  const raw = String(body.id ?? "").trim();
  if (!/^\d+$/.test(raw)) return Response.json({ error: "id must be a pipeline record number" }, { status: 400 });
  const id = String(parseInt(raw, 10));

  const pdf = await tailoredCvFor(id);
  if (!pdf) return Response.json({ error: "no tailored CV for this pipeline record" }, { status: 404 });
  const app = findApplication(id);
  const core = await exportCore();
  const name = app ? core.exportFileName(id, app.company, app.role) : path.basename(pdf);
  // The same CV in the Tailored-CVs export folder, for the user to pick by hand
  // when a site blocks the attach. Empty when it has not been exported yet.
  let localFile = "";
  try {
    const candidate = path.join(core.exportDir(careerOpsRoot()), name);
    if (fs.statSync(candidate).isFile()) localFile = candidate;
  } catch {
    localFile = "";
  }

  const { token, expiresAt } = mintHandoff(id);
  const { protocol, host } = new URL(req.url);
  return Response.json(
    {
      id,
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
