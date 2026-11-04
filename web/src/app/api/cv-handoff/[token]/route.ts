import fs from "node:fs";
import path from "node:path";
import { exportCore, tailoredCvFor } from "@/lib/cv-export";
import { findApplication } from "@/lib/career-ops";
import { inlineDisposition } from "@/lib/content-disposition.mjs";
import { redeemHandoff } from "@/lib/cv-handoff.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read a handoff link minted by POST /api/cv-handoff: the tailored CV PDF, for
// the job application page that fetches it. Any origin may read it, because
// the token is the permission (see lib/cv-handoff.mjs); proxy.ts lets only
// this path through from another site, and still checks the Host.
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function gone(): Response {
  return Response.json({ error: "this CV link expired or was already used; make a new one from Career Reef" }, { status: 404, headers: CORS });
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const id = redeemHandoff(token);
  if (!id) return gone();
  const pdf = await tailoredCvFor(id);
  if (!pdf) return gone();
  const app = findApplication(id);
  const name = app ? (await exportCore()).exportFileName(id, app.company, app.role) : path.basename(pdf);
  let buf: Buffer;
  try {
    buf = fs.readFileSync(pdf);
  } catch {
    return Response.json({ error: "could not read the PDF" }, { status: 500, headers: CORS });
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/pdf", "Content-Disposition": inlineDisposition(name) },
  });
}

// Preflight, including Chrome's private/local network access check for a
// public site reaching localhost. Spends no read.
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Private-Network": "true", "Access-Control-Allow-Headers": "*" },
  });
}
