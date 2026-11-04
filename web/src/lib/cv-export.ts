import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { careerOpsRoot, isRegularContainedFile, pdfPathStatusForReport, readApplications, readReport } from "@/lib/career-ops";
import { resolveTailoredCv } from "@/lib/apply/cv";
import { reportNumberFromCell } from "@/lib/apply/cv-selection.mjs";
import { unwrapReportUrlToken } from "@/lib/core/report-url-token.mjs";
import { parseAllowedOrigins } from "@/lib/origin-guard.mjs";
import { postingHref } from "@/lib/posting-url.mjs";

// Tailored-CV export for companion clients (another assistant, a browser
// extension). Read-only over the user's files except for the export folder,
// which only ever gains or refreshes the files this module names: nothing in
// it is deleted.

export type CvExportRecord = {
  id: string;
  company: string;
  job_title: string;
  job_url: string | null;
  status: string;
  cv_file: string | null;
};

const REPORT_URL = /\*\*URL:\*\*[ \t]*(\S+)/;

/** ASCII words joined by "-", capped so the file name stays a sane length. */
function slug(s: string, max: number): string {
  const out = (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-");
  return (out.length > max ? out.slice(0, max).replace(/-[^-]*$/, "") : out) || "untitled";
}

export function exportFileName(id: string, company: string, title: string): string {
  return `${id}-${slug(company, 40)}-${slug(title, 60)}.pdf`;
}

/** The tailored CV PDF for a tracker row, the same lookup the pipeline page uses. */
export async function tailoredCvFor(id: string): Promise<string | null> {
  if (!/^\d+$/.test(id)) return null;
  const viaRow = await resolveTailoredCv(undefined, id);
  const found = viaRow ?? (await pdfPathStatusForReport(id).then((r) => (r.status === "found" ? r.path : null)));
  if (!found || !/\.pdf$/i.test(found) || !isRegularContainedFile(found, careerOpsRoot())) return null;
  return found;
}

function jobUrl(app: { url: string; report: string; n: string }): string | null {
  const fromCell = postingHref(app.url);
  if (fromCell) return fromCell;
  const reportNumber = reportNumberFromCell(app.report);
  const report = readReport(String(reportNumber ?? app.n));
  const m = report ? REPORT_URL.exec(report.content) : null;
  return m ? unwrapReportUrlToken(m[1]) : null;
}

export async function exportRecords(): Promise<{ record: CvExportRecord; pdf: string | null }[]> {
  const out = [];
  for (const app of readApplications()) {
    const id = String(parseInt(app.n, 10));
    if (id === "NaN") continue;
    const pdf = await tailoredCvFor(id);
    out.push({
      record: { id, company: app.company, job_title: app.role, job_url: jobUrl(app), status: app.status, cv_file: pdf ? exportFileName(id, app.company, app.role) : null },
      pdf,
    });
  }
  return out;
}

export function exportDir(): string {
  return process.env.CAREER_OPS_CV_EXPORT_DIR?.trim() || path.join(os.homedir(), "Desktop", "Tailored-CVs");
}

/** Copy every tailored CV into the export folder and write manifest.json beside them. */
export async function writeExport(dir = exportDir()) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (const { record, pdf } of await exportRecords()) {
    if (!pdf || !record.cv_file) continue;
    fs.copyFileSync(pdf, path.join(dir, record.cv_file));
    files.push({ file: record.cv_file, id: record.id, company: record.company, job_title: record.job_title, job_url: record.job_url });
  }
  const manifest = path.join(dir, "manifest.json");
  fs.writeFileSync(manifest, JSON.stringify({ generated: new Date().toISOString(), files }, null, 2) + "\n", "utf8");
  return { dir, manifest, files };
}

/**
 * CORS for the export routes only: a chrome-extension:// origin that
 * CAREER_OPS_ALLOWED_ORIGINS already lets through the proxy may read the
 * response. Every other origin gets no CORS header, so the routes stay as
 * closed as the rest of the dashboard.
 */
export function exportCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  if (!origin.startsWith("chrome-extension://") || !parseAllowedOrigins(process.env.CAREER_OPS_ALLOWED_ORIGINS).has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" };
}
