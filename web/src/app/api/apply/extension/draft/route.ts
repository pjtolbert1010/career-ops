import fs from "node:fs";
import path from "node:path";
import { cliUnavailableError, resolveCliOrFallback } from "@/lib/clis";
import { careerOpsRoot, readMemory } from "@/lib/career-ops";
import { profileRef } from "@/lib/core/profile-path.mjs";
import { resolveSessionCv } from "@/lib/apply/cv";
import { applyCvSource } from "@/lib/apply/cv-source.mjs";
import { buildAnswerPrompt } from "@/lib/apply/answer-prompt.mjs";
import { runPlanner, type PlannerField } from "@/lib/apply/planner";
import { extractJsonObject } from "@/lib/extract-json-object.mjs";
import { readJsonObject } from "@/lib/json-body";
import { findEntry, loadBank, normalizeQuestion } from "@/lib/apply/answer-bank.mjs";
import { loadAnswers, lookupByLabel } from "@/lib/answers.mjs";
import { eeoDecline } from "@/lib/apply/eeo-decline.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 320;

// Draft answers for a form the career-ops Chrome extension read in the user's
// own browser tab. Same planner, prompt and tailored-CV resolution as
// /api/apply/prefill; the difference is that the fields come from the request,
// because there is no Playwright session holding the page. The tailored CV is
// returned with the answers so the extension can attach it to the resume input.
// Nothing here submits anything: the extension fills, the user submits.

const FIELD_TYPES = new Set(["text", "email", "tel", "url", "number", "date", "textarea", "select", "checkbox", "radio", "file"]);
const MAX_FIELDS = 150;
const MAX_CV_BYTES = 10 * 1024 * 1024;

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function cleanFields(raw: unknown): PlannerField[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_FIELDS) return null;
  const out: PlannerField[] = [];
  for (const f of raw) {
    if (!f || typeof f !== "object") return null;
    const o = f as Record<string, unknown>;
    const id = str(o.id, 40);
    const type = str(o.type, 20);
    if (!/^[\w-]+$/.test(id) || !FIELD_TYPES.has(type)) return null;
    const options = Array.isArray(o.options) ? o.options.slice(0, 80).map((x) => str(x, 160)).filter(Boolean) : undefined;
    out.push({ id, type, label: str(o.label, 160), required: o.required === true, ...(options && options.length ? { options } : {}) } as PlannerField);
  }
  return out;
}

export async function POST(req: Request) {
  const body = await readJsonObject<{ title?: unknown; fields?: unknown; cliId?: unknown; company?: unknown; application?: unknown }>(req);
  if (!body) return Response.json({ error: "bad json" }, { status: 400 });
  const fields = cleanFields(body.fields);
  if (!fields) return Response.json({ error: "fields must be a non-empty list of form fields" }, { status: 400 });
  for (const k of ["cliId", "company", "application", "title"] as const) {
    if (body[k] !== undefined && typeof body[k] !== "string") return Response.json({ error: `${k} must be a string` }, { status: 400 });
  }
  const title = str(body.title, 200);
  const company = (body.company as string | undefined) || undefined;
  const application = (body.application as string | undefined) || undefined;

  const t0 = Date.now();
  const logPath = path.join(careerOpsRoot(), ".career-ops-web", "apply-prefill.log");
  const log = (m: string) => {
    try {
      fs.mkdirSync(path.dirname(logPath), { recursive: true });
      fs.appendFileSync(logPath, `${new Date().toISOString()} [ext +${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}\n`);
    } catch {
      /* ignore */
    }
  };

  const resolved = body.cliId ? resolveCliOrFallback(body.cliId as string) : null;
  if (!resolved) return Response.json({ error: cliUnavailableError((body.cliId as string) ?? "").error }, { status: 400 });
  const { spec, binPath } = resolved;

  const cvPath = await resolveSessionCv({ company, application, title });
  const cvSource = cvPath ? applyCvSource(careerOpsRoot(), cvPath) : null;

  // Answers the user gave before. Short answers (choices, names, dates) are
  // filled straight from the bank and never reach the planner; a saved essay
  // is handed to the planner as the user's earlier answer to reuse or adapt,
  // because "why this employer" text must not be pasted into another employer's form.
  const bank = loadBank(careerOpsRoot());
  let fixed: Record<string, unknown> = {};
  try {
    fixed = loadAnswers();
  } catch {
    /* no answers.yml */
  }
  const fromBank: Record<string, { value: string; needs_confirmation: false; source: string }> = {};
  const essays: string[] = [];
  const toPlan: PlannerField[] = [];
  for (const f of fields) {
    const declined = eeoDecline(f, fixed as never);
    if (declined) {
      fromBank[f.id] = { value: declined, needs_confirmation: false, source: "eeo decline" };
      continue;
    }
    const entry = findEntry(bank, f.label);
    if (entry && f.type !== "textarea") {
      fromBank[f.id] = { value: entry.answer, needs_confirmation: false, source: "bank" };
      continue;
    }
    if (entry) essays.push(`- "${entry.question}": ${entry.answer}`);
    const known = f.type !== "textarea" && f.type !== "file" ? lookupByLabel(normalizeQuestion(f.label), fixed as never) : null;
    if (known && !known.sensitive && known.value.trim()) {
      fromBank[f.id] = { value: known.value, needs_confirmation: false, source: "answers.yml" };
      continue;
    }
    toPlan.push(f);
  }
  const memory = [readMemory().trim(), essays.length ? `Answers the user saved earlier to questions on this form. Reuse them; change only details specific to the other employer:\n${essays.join("\n")}` : ""].filter(Boolean).join("\n\n");
  log(`extension draft: "${title}" · ${fields.length} fields · ${Object.keys(fromBank).length} from saved answers · app=${application ?? "-"} · cv=${cvSource ?? "none"}`);

  let obj: Record<string, unknown> = {};
  let truncated = false;
  if (toPlan.length) {
    const prompt = buildAnswerPrompt({ title, fields: toPlan, memory, cvSource, profile: profileRef(careerOpsRoot()) });
    const result = await runPlanner({ cliId: spec.id, spec, binPath, prompt, fieldCount: toPlan.length, cwd: careerOpsRoot(), t0, log });
    if (result.refused) return Response.json({ error: result.refused }, { status: 500 });
    const parsed = extractJsonObject(result.buf);
    if (!parsed.obj) {
      log(`extension draft: unparseable output (code=${result.code} signal=${result.signal})`);
      return Response.json({ error: result.buf.trim() ? "couldn't parse the planner's answer" : "planner produced no output" }, { status: 500 });
    }
    obj = parsed.obj as Record<string, unknown>;
    truncated = parsed.truncated;
  }
  obj = { ...obj, ...fromBank };

  let cv: { name: string; base64: string } | null = null;
  if (cvPath) {
    try {
      const st = fs.statSync(cvPath);
      if (st.isFile() && st.size <= MAX_CV_BYTES && /\.pdf$/i.test(cvPath)) cv = { name: path.basename(cvPath), base64: fs.readFileSync(cvPath).toString("base64") };
    } catch {
      /* no attachment */
    }
  }
  log(`extension draft: ${Object.keys(obj).length} answers${truncated ? " (truncated)" : ""} · cv attached=${!!cv}`);
  // One line per field, so a form that comes back mostly "needs you" can be
  // diagnosed from the log: was it the label, or the planner's choice?
  for (const f of fields) {
    const a = (obj as Record<string, unknown>)[f.id];
    const ans = a && typeof a === "object" ? (a as { value?: unknown; needs_confirmation?: unknown }) : { value: a };
    const verdict = fromBank[f.id] ? `saved answer (${fromBank[f.id].source})` : ans.needs_confirmation ? "NEEDS YOU" : ans.value != null && String(ans.value).trim() ? `answer (${String(ans.value).length} chars)` : "blank";
    log(`  ${f.id} [${f.type}${f.required ? "*" : ""}] "${f.label}"${f.options?.length ? ` {${f.options.length} options}` : ""} → ${verdict}`);
  }
  return Response.json({ answers: obj, truncated, cv });
}
