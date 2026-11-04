import fs from "node:fs";
import path from "node:path";
import { exportCore, exportCorsHeaders, tailoredCvFor } from "@/lib/cv-export";
import { findApplication } from "@/lib/career-ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The tailored CV PDF for one pipeline record (/pipeline/:id), as a download
// named {id}-{company}-{job-title}.pdf. Read-only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cors = exportCorsHeaders(req);
  const { id: raw } = await params;
  if (!/^\d+$/.test(raw)) return Response.json({ error: "invalid pipeline id" }, { status: 400, headers: cors });
  const id = String(parseInt(raw, 10));
  const pdf = await tailoredCvFor(id);
  if (!pdf) return Response.json({ error: "no tailored CV for this pipeline record" }, { status: 404, headers: cors });
  const app = findApplication(id);
  const name = app ? (await exportCore()).exportFileName(id, app.company, app.role) : path.basename(pdf);
  let buf: Buffer;
  try {
    buf = fs.readFileSync(pdf);
  } catch {
    return Response.json({ error: "could not read the PDF" }, { status: 500, headers: cors });
  }
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: exportCorsHeaders(req) });
}
