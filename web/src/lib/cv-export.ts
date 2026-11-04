import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsRoot, isRegularContainedFile, pdfPathStatusForReport } from "@/lib/career-ops";
import { resolveTailoredCv } from "@/lib/apply/cv";
import { resolveCodeRoot } from "@/lib/core/code-root.mjs";
import { parseAllowedOrigins } from "@/lib/origin-guard.mjs";

// Tailored-CV export for companion clients (another assistant, a browser
// extension). The export itself (file names, folder, manifest) lives in the
// core's export-cvs.mjs, which generate-pdf.mjs also runs after each CV, so
// the dashboard and the CLI write the same files. Nothing in the export
// folder is ever deleted.

export type CvExportRecord = {
  id: string;
  company: string;
  job_title: string;
  job_url: string | null;
  status: string;
  cv_file: string | null;
};

type ExportCore = {
  exportFileName(id: string, company: string, title: string): string;
  exportRecords(root: string): { record: CvExportRecord; pdf: string | null }[];
  writeExport(root: string): { dir: string; manifest: string; files: { file: string; id: string; company: string; job_title: string; job_url: string | null }[] };
};

/** The core's export-cvs.mjs, loaded at runtime from the running checkout. */
export async function exportCore(): Promise<ExportCore> {
  const file = path.join(resolveCodeRoot(process.cwd(), process.env), "export-cvs.mjs");
  return (await import(/* webpackIgnore: true */ pathToFileURL(file).href)) as ExportCore;
}

export async function exportRecords() {
  return (await exportCore()).exportRecords(careerOpsRoot());
}

export async function writeExport() {
  return (await exportCore()).writeExport(careerOpsRoot());
}

/** The tailored CV PDF for a tracker row, the same lookup the pipeline page uses. */
export async function tailoredCvFor(id: string): Promise<string | null> {
  if (!/^\d+$/.test(id)) return null;
  const viaRow = await resolveTailoredCv(undefined, id);
  const found = viaRow ?? (await pdfPathStatusForReport(id).then((r) => (r.status === "found" ? r.path : null)));
  if (!found || !/\.pdf$/i.test(found) || !isRegularContainedFile(found, careerOpsRoot())) return null;
  return found;
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
