import { exportRecords } from "@/lib/cv-export";
import { matchPage } from "@/lib/apply/match-page.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The pipeline job a browser tab belongs to, for the career-ops extension when
// the user turns it on in a tab the dashboard did not open. Read-only.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!/^https?:\/\//i.test(url) || url.length > 2000) return Response.json({ error: "url must be an http(s) URL" }, { status: 400 });
  const records = (await exportRecords()).map((r) => r.record);
  const hit = matchPage(url, records);
  return Response.json(hit ? { n: hit.id, company: hit.company, title: hit.job_title } : {});
}
