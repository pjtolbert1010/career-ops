import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { careerOpsRoot, findApplication, isRegularContainedFile } from "@/lib/career-ops";
import { resolveCodeRoot } from "@/lib/core/code-root.mjs";
import { resolveTailoredCover } from "@/lib/apply/cover";
import { tailoredCvFor } from "@/lib/cv-export";

// Per-application documents beyond the CV: the Statement of Qualifications
// (CalCareers) and the cover letter (every other job). Both live in output/
// under the tracker row number (soq-095-…pdf, cover-095-…pdf), named and found
// by the core's generate-soq.mjs, so the CLI mode, Career Reef and the Chrome
// skills always agree on which file belongs to which application.

export type DocKind = "cv" | "soq" | "cover";
export const DOC_KINDS: DocKind[] = ["cv", "soq", "cover"];

export type SoqInstructions = {
  soq_required: boolean;
  cover_letter_required: boolean;
  cover_letter_page_limit: number | null;
  resume: string | null;
  format: { font: string | null; size_pt: number | null; margins_in: number | null; line_spacing: number | null; page_limit: number | null };
  numbered: boolean;
  prompts: { number: number; prompt: string }[];
  instructions: string;
  required_documents: string;
};

export type SoqRenderResult = {
  ok: boolean;
  path?: string;
  file?: string;
  pages?: number | null;
  page_limit?: number;
  over_limit?: boolean;
  reason?: string;
  fact_warnings?: string[];
};

type SoqCore = {
  SOQ_DEFAULTS: { font: string; size_pt: number; margins_in: number; line_spacing: number; page_limit: number };
  extractSoqInstructions(text: string): SoqInstructions;
  jdTextFromReport(markdown: string): string;
  docFileName(kind: "soq" | "cover", n: string, company: string, date: string, role?: string): string;
  isDocFor(fileName: string, kind: "soq" | "cover", n: string): boolean;
  findDoc(root: string, kind: "soq" | "cover", n: string): string | null;
  renderSoq(payload: unknown, opts: { root: string }): Promise<SoqRenderResult>;
};

/** The core's generate-soq.mjs, loaded at runtime from the running checkout. */
export async function soqCore(): Promise<SoqCore> {
  const file = path.join(resolveCodeRoot(process.cwd(), process.env), "generate-soq.mjs");
  return (await import(/* webpackIgnore: true */ pathToFileURL(file).href)) as SoqCore;
}

/** CalCareers and its jobs.ca.gov mirror: the State of California's job portal. */
export function isCalCareersUrl(url: string | undefined | null): boolean {
  try {
    const host = new URL(String(url || "")).hostname.toLowerCase();
    return host === "calcareers.ca.gov" || host.endsWith(".calcareers.ca.gov") || host === "jobs.ca.gov" || host.endsWith(".jobs.ca.gov");
  } catch {
    return false;
  }
}

function contained(file: string | null): string | null {
  if (!file || !/\.pdf$/i.test(file)) return null;
  return isRegularContainedFile(file, path.join(careerOpsRoot(), "output")) ? file : null;
}

/** The newest SOQ PDF saved for tracker row n, or null. */
export async function tailoredSoqFor(n: string): Promise<string | null> {
  if (!/^\d+$/.test(n)) return null;
  return contained((await soqCore()).findDoc(careerOpsRoot(), "soq", n));
}

/**
 * The cover letter for tracker row n: a numbered cover-{NNN}-… file first, then
 * the company + role match resolveTailoredCover has always made (letters the
 * `cover` mode saved before numbered names existed).
 */
export async function tailoredCoverFor(n: string): Promise<string | null> {
  if (!/^\d+$/.test(n)) return null;
  const numbered = contained((await soqCore()).findDoc(careerOpsRoot(), "cover", n));
  if (numbered) return numbered;
  return contained(await resolveTailoredCover(undefined, n));
}

export async function tailoredDocFor(kind: DocKind, n: string): Promise<string | null> {
  if (kind === "cv") return tailoredCvFor(n);
  if (kind === "soq") return tailoredSoqFor(n);
  return tailoredCoverFor(n);
}

/** File name a document is handed to a job site under. */
export function handoffName(kind: DocKind, n: string, company: string, role: string, file: string): string {
  if (kind === "cv") return path.basename(file);
  const label = kind === "soq" ? "Statement-of-Qualifications" : "Cover-Letter";
  const who = `${company} ${role}`.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${label}-${n}-${who || "application"}.pdf`;
}

/** The posting text for a tracker row: its report's archived JD. Empty when there is none. */
export function postingTextFor(n: string, core: Pick<SoqCore, "jdTextFromReport">): { text: string; reportFile: string | null } {
  const app = findApplication(n);
  const rel = app?.report.match(/\((\.\.\/)?(reports\/[^)]+\.md)\)/)?.[2];
  if (!rel) return { text: "", reportFile: null };
  const file = path.join(careerOpsRoot(), rel);
  if (!isRegularContainedFile(file, path.join(careerOpsRoot(), "reports"))) return { text: "", reportFile: null };
  try {
    return { text: core.jdTextFromReport(fs.readFileSync(file, "utf8")), reportFile: rel };
  } catch {
    return { text: "", reportFile: null };
  }
}
