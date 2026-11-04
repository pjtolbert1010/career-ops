import { exportCorsHeaders, exportRecords, writeExport } from "@/lib/cv-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: every pipeline record with its job title, job URL, company and tailored
// CV file name (null when it has none). Read-only.
export async function GET(req: Request) {
  const records = (await exportRecords()).map((r) => r.record);
  return Response.json({ records }, { headers: exportCorsHeaders(req) });
}

// POST: copy every tailored CV to the export folder (~/Desktop/Tailored-CVs by
// default, CAREER_OPS_CV_EXPORT_DIR to change it) and write its manifest.json.
// Only adds or refreshes those files; deletes nothing.
export async function POST(req: Request) {
  const cors = exportCorsHeaders(req);
  try {
    return Response.json(await writeExport(), { headers: cors });
  } catch (err) {
    return Response.json({ error: `export failed: ${(err as Error).message}` }, { status: 500, headers: cors });
  }
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: exportCorsHeaders(req) });
}
