import fs from "node:fs";
import path from "node:path";
import { inlineDisposition } from "@/lib/content-disposition.mjs";
import { DOC_KINDS, tailoredDocFor, type DocKind } from "@/lib/apply/docs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// View one application's CV, SOQ or cover letter inline (Career Reef's
// Documents panel). Same-origin only, like every dashboard route.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  if (!/^\d+$/.test(raw)) return new Response("id must be a pipeline record number", { status: 400 });
  const kind = (new URL(req.url).searchParams.get("kind") ?? "cv") as DocKind;
  if (!DOC_KINDS.includes(kind)) return new Response('kind must be "cv", "soq" or "cover"', { status: 400 });
  const file = await tailoredDocFor(kind, String(parseInt(raw, 10)));
  if (!file) return new Response("no such document for this application yet", { status: 404 });
  try {
    const buf = fs.readFileSync(file);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": inlineDisposition(path.basename(file)), "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("could not read the PDF", { status: 500 });
  }
}
