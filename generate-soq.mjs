#!/usr/bin/env node
/**
 * generate-soq.mjs — Statement of Qualifications (SOQ) for California state
 * jobs posted on CalCareers, rendered to PDF in the exact format the job
 * posting asks for (font, point size, margins, page limit, numbered prompts).
 *
 * Usage:
 *   node generate-soq.mjs --payload soq.json            render, fact-check, page-check
 *   node generate-soq.mjs --instructions <report.md>    print the SOQ rules found in a JD (JSON)
 *   node generate-soq.mjs --find <tracker#>             print the newest SOQ PDF for that row
 *
 * Payload (JSON):
 *   {
 *     "tracker": 100,                          tracker row number (names the file)
 *     "candidate": { "name", "email", "phone", "location" },
 *     "posting": { "department", "title", "classification", "jc" },
 *     "format": { "font": "Arial", "size_pt": 12, "margins_in": 1,
 *                 "line_spacing": 1.15, "page_limit": 2,
 *                 "header_align": "center|left|right", "show_prompts": true },
 *     "heading": "Statement of Qualifications",
 *     "items": [ { "number": 1, "prompt": "…", "response": ["paragraph", …] } ],
 *     "user_inputs": [ "facts the candidate stated in chat for this SOQ" ]
 *   }
 *
 * Output: output/soq-{NNN}-{department-slug}-{YYYY-MM-DD}.pdf, NNN being the
 * tracker row number padded to 3 digits. Career Reef finds a row's SOQ by
 * that prefix, so the file never needs a manifest.
 *
 * Guarantees:
 *   - The fact gate (verify-cv-facts.mjs) checks the SOQ against cv.md and
 *     article-digest.md, like the cover letter. A blocking finding stops the
 *     render; nothing is written.
 *   - A render longer than format.page_limit is NOT kept: the posting treats an
 *     over-length SOQ as disqualifying, so the command exits 3 and the caller
 *     shortens the text. The last good version, if any, stays in place.
 *
 * The last line on stdout is one JSON object: { ok, path, pages, page_limit, … }.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { basename, join, resolve } from "path";
import { randomUUID } from "crypto";
import { parseArgs } from "util";
import { assertFacts, printFactWarnings } from "./verify-cv-facts.mjs";
import { isMainModule } from "./lib/is-main-module.mjs";
import { getCareerOpsRoot, resolveTrackerPath } from "./path-resolver.mjs";
import { resolvePdfIndexPath } from "./tracker-utils.mjs";
import { withPipelineLock } from "./pipeline-lock.mjs";

const FONTS = {
  arial: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  "times new roman": '"Times New Roman", Times, "Liberation Serif", serif',
  calibri: 'Calibri, Carlito, "Segoe UI", Arial, sans-serif',
  verdana: "Verdana, Geneva, sans-serif",
  helvetica: 'Helvetica, Arial, "Liberation Sans", sans-serif',
  tahoma: "Tahoma, Verdana, sans-serif",
  "century gothic": '"Century Gothic", "URW Gothic", Arial, sans-serif',
  garamond: 'Garamond, "EB Garamond", "Times New Roman", serif',
  georgia: 'Georgia, "Times New Roman", serif',
  cambria: 'Cambria, Caladea, Georgia, serif',
};
const FONT_NAMES = ["Times New Roman", "Century Gothic", "Arial", "Calibri", "Verdana", "Helvetica", "Tahoma", "Garamond", "Georgia", "Cambria"];
const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

/** Defaults most CalCareers SOQ instructions use when they leave a rule out. */
export const SOQ_DEFAULTS = Object.freeze({ font: "Arial", size_pt: 12, margins_in: 1, line_spacing: 1.15, page_limit: 2 });

// ---------------------------------------------------------------------------
// Reading the posting

function squash(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function toNumber(word) {
  const w = String(word || "").toLowerCase();
  if (NUMBER_WORDS[w]) return NUMBER_WORDS[w];
  const n = parseInt(w, 10);
  return Number.isFinite(n) ? n : null;
}

/** "no more than two pages", "not to exceed 2 pages", "two (2) page maximum", "limited to one page". */
export function pageLimitIn(text) {
  const t = squash(text);
  const patterns = [
    /(?:no more than|not to exceed|not exceed|shall not exceed|must not exceed|maximum of|max(?:imum)?\.?|limited to|up to|no longer than|cannot exceed|should not exceed|not more than)\s+(?:a\s+)?(one|two|three|four|five|six|\d)\s*(?:\(\s*\d\s*\)\s*)?(?:single[- ]sided\s+|typed\s+|double[- ]spaced\s+|written\s+)*pages?/i,
    /(one|two|three|four|five|six|\d)\s*(?:\(\s*\d\s*\)\s*)?[- ]?pages?\s*(?:maximum|max|limit|or less|or fewer|in length)/i,
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) {
      const n = toNumber(m[1]);
      if (n && n >= 1 && n <= 10) return n;
    }
  }
  return null;
}

/** "12-point Arial", "Arial 12 pt", "font size 11", "Times New Roman, size 12". */
export function fontIn(text) {
  const t = squash(text);
  const names = FONT_NAMES.map((n) => n.replace(/ /g, "\\s+")).join("|");
  let font = null;
  let size = null;
  let m = t.match(new RegExp(`(\\d{1,2})\\s*[- ]?\\s*(?:point|pt\\.?)\\s*(?:font\\s*(?:size)?\\s*)?(?:,?\\s*(?:in\\s+)?(${names}))?`, "i"));
  if (m) {
    size = parseInt(m[1], 10);
    if (m[2]) font = m[2];
  }
  if (!font || !size) {
    m = t.match(new RegExp(`(${names})\\s*(?:font)?\\s*,?\\s*(?:(?:size|font size|at)\\s*)?(\\d{1,2})\\s*(?:point|pt)?`, "i"));
    if (m) {
      font = font || m[1];
      if (!size && /\d/.test(m[2])) size = parseInt(m[2], 10);
    }
  }
  if (!font) {
    m = t.match(new RegExp(`(?:font|typeface)[^.]{0,40}?(${names})|(${names})\\s+font`, "i"));
    if (m) font = m[1] || m[2];
  }
  if (!size) {
    m = t.match(/font\s*size\s*(?:of\s*)?(\d{1,2})/i);
    if (m) size = parseInt(m[1], 10);
  }
  if (size && (size < 8 || size > 16)) size = null;
  const canonical = font ? FONT_NAMES.find((n) => n.toLowerCase() === squash(font).toLowerCase()) || squash(font) : null;
  return { font: canonical, size_pt: size };
}

/** "1-inch margins", "one inch margins", "margins of 1 inch". */
export function marginsIn(text) {
  const t = squash(text);
  const m = t.match(/(one|1|0?\.\d+|1\.\d+)\s*(?:-|\s)?\s*(?:inch(?:es)?|["”″])\s*margins?/i) || t.match(/margins?\s*(?:of|at|:|not less than|of at least|no less than|at least|no smaller than)?\s*(one|1|0?\.\d+|1\.\d+)\s*(?:-|\s)?\s*inch/i);
  if (!m) return null;
  const v = m[1].toLowerCase() === "one" ? 1 : parseFloat(m[1]);
  return Number.isFinite(v) && v > 0.2 && v <= 2 ? v : null;
}

/** "single-spaced" → 1, "double-spaced" → 2, "1.5 line spacing" → 1.5. */
export function spacingIn(text) {
  const t = squash(text);
  if (/single[- ]spac/i.test(t)) return 1;
  if (/double[- ]spac/i.test(t)) return 2;
  const m = t.match(/(1\.5|1\.15|2)\s*(?:line\s*)?spac/i);
  return m ? parseFloat(m[1]) : null;
}

/**
 * The numbered prompts in an SOQ instruction block, in order. Accepts "1." and
 * "1)" markers; only a run that starts at 1 and counts up is read as prompts,
 * so a stray "12-point" or "(916) 445" never starts one.
 */
export function promptsIn(text) {
  const t = squash(text);
  const markers = [...t.matchAll(/(?:^|[\s:;])(\d{1,2})[.)]\s+(?=[A-Z(“"'])/g)];
  const run = [];
  let want = 1;
  for (const m of markers) {
    if (parseInt(m[1], 10) === want) {
      run.push({ number: want, at: m.index + m[0].indexOf(m[1]), bodyAt: m.index + m[0].length });
      want += 1;
    }
  }
  if (!run.length) return [];
  const STOP = /\s(?:Possession of (?:the )?Minimum|Applications? (?:received|that|submitted|without)|Failure to|Please (?:redact|note|visit|submit|do not)|Resumes?,? cover letters|If you are basing|Unofficial|Application Instructions|Additional Application Instructions|Desirable Qualifications|Benefits\b|Contact Information|Equal Opportunity|SOQs? (?:that|which) (?:exceed|do not)|The SOQ (?:must|should|will|shall)|Each SOQ|Submit (?:your|the)|Responses? (?:must|should|will)|Note:)/;
  return run.map((r, i) => {
    const end = i + 1 < run.length ? run[i + 1].at : t.length;
    let body = t.slice(r.bodyAt, end).trim();
    if (i === run.length - 1) {
      const s = body.slice(20).search(STOP);
      if (s >= 0) body = body.slice(0, s + 20).trim();
      if (body.length > 900) body = body.slice(0, 900).replace(/\s+\S*$/, "") + " …";
    }
    return { number: r.number, prompt: body };
  });
}

/** The required-documents list of a CalCareers posting. */
function requiredDocsBlock(t) {
  const start = t.search(/Required Application Package Documents/i);
  if (start < 0) return "";
  const rest = t.slice(start);
  const end = rest.slice(40).search(/Applicants requiring reasonable accommodations|Desirable Qualifications|Benefits Benefit|Contact Information/i);
  return end >= 0 ? rest.slice(0, end + 40) : rest.slice(0, 2500);
}

/**
 * What a posting asks for: is an SOQ required, a cover letter, a resume? And
 * the SOQ's own rules — format and numbered prompts — when the posting has
 * them. Best effort and literal: anything not stated comes back null, and the
 * caller fills it from SOQ_DEFAULTS while telling the user it was not stated.
 */
export function extractSoqInstructions(jdText) {
  const t = squash(jdText);
  const docs = requiredDocsBlock(t);
  const soqNamed = /Statement of Qualifications|\bSOQ\b/i;
  const soqRequired = docs ? soqNamed.test(docs) : /(?:Statement of Qualifications|\bSOQ\b)[^.]{0,120}\b(?:is required|are required|must be submitted|must be included|required)\b/i.test(t);
  const coverInDocs = docs ? /Cover Letter/i.test(docs) : false;
  const resume = docs ? (/Resume is required/i.test(docs) ? "required" : /Resume is optional/i.test(docs) ? "optional" : /Resume/i.test(docs) ? "listed" : null) : null;

  // The SOQ instruction block: from the sentence that defines the SOQ to the
  // next section heading. Postings put it under "Special Requirements", under
  // "Statement of Qualifications (SOQ) instructions" at the end, or inline.
  let block = "";
  let startAt = -1;
  const docsAt = docs ? t.indexOf(docs) : -1;
  // Skip a mention inside the required-documents list, which only says "see below".
  const inDocs = (i) => docsAt >= 0 && i >= docsAt && i < docsAt + docs.length;
  if (soqRequired) {
    // The first SOQ mention outside that list that is followed by its rules:
    // a format word, or the questions it asks.
    const cue = /\b(?:pages?|font|point|typed|single[- ]spaced|double[- ]spaced|questions?|statements? below|following|respond|address)\b/i;
    for (const m of t.matchAll(/Statement of Qualifications|\bSOQ\b/gi)) {
      if (inDocs(m.index)) continue;
      if (cue.test(t.slice(m.index, m.index + 500))) {
        startAt = m.index;
        break;
      }
    }
  }
  if (startAt >= 0) {
    const rest = t.slice(startAt);
    const end = rest.slice(60).search(/\b(?:Application Instructions|Additional Application Instructions|Desirable Qualifications|Benefits Benefit|Contact Information|Equal Opportunity Employer|Who May Apply|How To Apply|Position Details|Department Information|Examination\/Assessment|Background Investigation|Eligibility (?:&|and) Examination|Required Application Package Documents)\b/);
    block = end >= 0 ? rest.slice(0, end + 60) : rest.slice(0, 4000);
  }

  // A written "Supplemental Questionnaire" is an SOQ under another name
  // (JC-535245: "Please limit your answer to two pages maximum (Arial 12 pt
  // font and 1” margins). 1. Describe ..."). The required-documents list then
  // says only "See Supplemental Questionnaire information under Special
  // Instructions", so the SOQ test above misses it. Count it only when its
  // own section carries a written format (pages or font) and a numbered run of
  // at least two questions: an online questionnaire has neither.
  let supplemental = false;
  if (startAt < 0) {
    for (const m of t.matchAll(/Supplemental Questionnaire|Statement of Qualifications|\bSOQ\b/gi)) {
      if (inDocs(m.index)) continue;
      const window = t.slice(m.index, m.index + 2500);
      const fmt = window.search(/\b(?:limit your (?:answer|response)s?|pages? (?:maximum|max|limit)|no more than \w+ pages?|\d+[- ]?(?:pt|point)\b|font)/i);
      if (fmt < 0) continue;
      const qs = promptsIn(window.slice(fmt));
      if (qs.length < 2) continue;
      startAt = m.index;
      supplemental = true;
      break;
    }
    if (startAt >= 0) {
      const rest = t.slice(startAt);
      const end = rest.slice(60).search(/\b(?:The following basis of eligibility|Application Instructions|Additional Application Instructions|Desirable Qualifications|Benefits Benefit|Contact Information|Equal Opportunity Employer|Who May Apply|How To Apply|Position Details|Department Information|Required Application Package Documents)\b/);
      block = end >= 0 ? rest.slice(0, end + 60) : rest.slice(0, 4000);
    }
  }

  const scope = block || (soqRequired ? docs : "");
  const font = fontIn(scope);
  const coverLimit = coverInDocs ? pageLimitIn(docs.slice(docs.search(/Cover Letter/i), docs.search(/Cover Letter/i) + 220)) : null;
  return {
    soq_required: Boolean(soqRequired || supplemental),
    soq_named_as: supplemental ? "Supplemental Questionnaire" : soqRequired ? "Statement of Qualifications" : null,
    cover_letter_required: Boolean(coverInDocs),
    cover_letter_page_limit: coverLimit,
    resume,
    format: {
      font: font.font,
      size_pt: font.size_pt,
      margins_in: marginsIn(scope),
      line_spacing: spacingIn(scope),
      page_limit: pageLimitIn(scope),
    },
    numbered: /numbered|in the same order|in order|each question/i.test(scope),
    prompts: block ? promptsIn(block) : [],
    instructions: block ? block.slice(0, 4000) : "",
    required_documents: docs ? docs.slice(0, 2500) : "",
  };
}

/** The archived JD of a report: its "## Job Description" section, else the whole file. */
export function jdTextFromReport(reportMarkdown) {
  const md = String(reportMarkdown || "");
  const start = md.search(/^##\s+Job Description[^\n]*$/m);
  if (start < 0) return md;
  const body = md.slice(start).replace(/^[^\n]*\n/, "");
  const next = body.search(/^##\s/m);
  return next >= 0 ? body.slice(0, next) : body;
}

// ---------------------------------------------------------------------------
// Files

export function slugify(text, max = 40) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function pad3(n) {
  const s = String(parseInt(String(n), 10));
  return s.length >= 3 ? s : s.padStart(3, "0");
}

/** output/ file name for an application document: soq-095-department-of-water-resources-2026-11-04.pdf */
export function docFileName(kind, n, company, date, role = "") {
  if (!/^\d+$/.test(String(n))) throw new Error("tracker number must be digits");
  if (kind !== "soq" && kind !== "cover") throw new Error(`unknown document kind "${kind}"`);
  const parts = [kind, pad3(n), slugify(company, 40) || "employer"];
  if (role) parts.push(slugify(role, 30));
  parts.push(date || new Date().toISOString().slice(0, 10));
  return `${parts.filter(Boolean).join("-")}.pdf`;
}

/** True when a file in output/ is the given kind's document for tracker row n. */
export function isDocFor(fileName, kind, n) {
  const f = String(fileName).toLowerCase();
  const m = f.match(/^(soq|cover)-(\d{1,5})-[a-z0-9-]+\.pdf$/);
  return Boolean(m && m[1] === kind && parseInt(m[2], 10) === parseInt(String(n), 10));
}

/** Newest SOQ (or numbered cover letter) PDF for tracker row n, or null. */
export function findDoc(root, kind, n) {
  if (!/^\d+$/.test(String(n))) return null;
  const dir = join(root, "output");
  let files;
  try {
    files = readdirSync(dir).filter((f) => isDocFor(f, kind, n));
  } catch {
    return null;
  }
  const stats = [];
  for (const f of files) {
    try {
      const st = statSync(join(dir, f));
      if (st.isFile()) stats.push([f, st.mtimeMs]);
    } catch {
      /* vanished */
    }
  }
  stats.sort((a, b) => b[1] - a[1]);
  return stats.length ? join(dir, stats[0][0]) : null;
}

// ---------------------------------------------------------------------------
// HTML

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampNumber(v, lo, hi, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
}

/** The format the SOQ renders with: the payload's, then SOQ_DEFAULTS. */
export function resolveFormat(format = {}) {
  const fontKey = String(format.font || SOQ_DEFAULTS.font).toLowerCase().trim();
  return {
    font: FONT_NAMES.find((n) => n.toLowerCase() === fontKey) || SOQ_DEFAULTS.font,
    stack: FONTS[fontKey] || FONTS.arial,
    size_pt: clampNumber(format.size_pt, 8, 16, SOQ_DEFAULTS.size_pt),
    margins_in: clampNumber(format.margins_in, 0.5, 1.5, SOQ_DEFAULTS.margins_in),
    line_spacing: clampNumber(format.line_spacing, 1, 2.5, SOQ_DEFAULTS.line_spacing),
    page_limit: Math.round(clampNumber(format.page_limit, 1, 10, SOQ_DEFAULTS.page_limit)),
    show_prompts: format.show_prompts !== false,
    // Where the name/JC header sits: some postings say "upper right hand corner" or "top left".
    header_align: ["left", "center", "right"].includes(format.header_align) ? format.header_align : "center",
  };
}

export function buildSoqHtml(payload) {
  if (!payload || typeof payload !== "object") throw new Error("payload must be an object");
  const candidate = payload.candidate || {};
  const posting = payload.posting || {};
  if (!candidate.name) throw new Error("Missing required field: candidate.name");
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) throw new Error("Missing required field: items (the SOQ's numbered responses)");
  const fmt = resolveFormat(payload.format);

  const contact = [candidate.email, candidate.phone, candidate.location].filter(Boolean).map(escapeHtml).join(" &nbsp;|&nbsp; ");
  const applyingFor = [posting.title, posting.classification && posting.classification !== posting.title ? posting.classification : "", posting.jc].filter(Boolean).map(escapeHtml).join(" &nbsp;|&nbsp; ");
  const body = items
    .map((it, i) => {
      const number = Number.isInteger(it.number) ? it.number : i + 1;
      const paras = (Array.isArray(it.response) ? it.response : [it.response]).map((p) => squash(p)).filter(Boolean);
      if (!paras.length) throw new Error(`item ${number} has no response`);
      const prompt = squash(it.prompt);
      const head = fmt.show_prompts && prompt ? `<p class="prompt"><span class="num">${number}.</span> ${escapeHtml(prompt)}</p>` : `<p class="prompt"><span class="num">${number}.</span></p>`;
      return `<section class="item">\n${head}\n${paras.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}\n</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(payload.heading || "Statement of Qualifications")} - ${escapeHtml(candidate.name)}</title>
<style>
  :root { --page-margin: ${fmt.margins_in}in; }
  html, body { margin: 0; padding: 0; }
  body { font-family: ${fmt.stack}; font-size: ${fmt.size_pt}pt; line-height: ${fmt.line_spacing}; color: #000; background: #fff; }
  .head { text-align: ${fmt.header_align}; margin-bottom: ${fmt.size_pt * 0.9}pt; }
  .head .name { font-weight: bold; }
  .head .title { font-weight: bold; text-transform: none; }
  .head div { margin: 0; }
  p { margin: 0 0 ${fmt.size_pt * 0.6}pt 0; text-align: left; orphans: 2; widows: 2; }
  .item { margin-bottom: ${fmt.size_pt * 0.4}pt; }
  .prompt { font-weight: bold; }
  .num { font-weight: bold; }
</style>
</head>
<body>
<div class="head">
  <div class="name">${escapeHtml(candidate.name)}</div>
  ${contact ? `<div>${contact}</div>` : ""}
  <div class="title">${escapeHtml(payload.heading || "Statement of Qualifications")}</div>
  ${applyingFor ? `<div>${applyingFor}</div>` : ""}
  ${posting.department ? `<div>${escapeHtml(posting.department)}</div>` : ""}
</div>
${body}
</body>
</html>
`;
}

/** Plain text of the SOQ, for the fact gate and for word counts. */
export function soqText(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items.map((it) => [it.prompt, ...(Array.isArray(it.response) ? it.response : [it.response])].filter(Boolean).join("\n")).join("\n\n");
}

// ---------------------------------------------------------------------------
// Render

/**
 * Render an SOQ payload to output/. Throws on a fact-gate block. Returns
 * { ok, path, pages, page_limit, over_limit, fact_warnings, format }.
 * An over-length render is deleted and returned with ok:false.
 */
export async function renderSoq(payload, { root = getCareerOpsRoot(), outName, render } = {}) {
  const n = payload?.tracker;
  if (!/^\d+$/.test(String(n ?? ""))) throw new Error("payload.tracker must be the tracker row number");
  const html = buildSoqHtml(payload);
  const fmt = resolveFormat(payload.format);

  // Check the responses only: the prompts are the posting's words, not claims.
  const responses = (payload.items || []).map((it) => (Array.isArray(it.response) ? it.response : [it.response]).join("\n")).join("\n\n");
  const planTexts = Array.isArray(payload.user_inputs) ? payload.user_inputs.filter((s) => typeof s === "string") : [];
  const factCheck = assertFacts(`<p>${escapeHtml(responses)}</p>`, { label: "SOQ", planTexts, cwd: root, sourcePaths: [join(root, "cv.md"), join(root, "article-digest.md")], configPath: join(root, "config", "cv-facts.json") });
  const warnings = [];
  if (factCheck.verdict === "warn") printFactWarnings(factCheck, (line) => warnings.push(String(line)));
  if (/—/.test(responses)) warnings.push("The SOQ contains an em dash (—). The house rules in modes/_custom.md forbid them in generated writing.");

  const outDir = join(root, "output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const finalName = outName || docFileName("soq", n, payload.posting?.department || payload.posting?.company || "employer", new Date().toISOString().slice(0, 10));
  if (!isDocFor(finalName, "soq", n)) throw new Error(`output name must look like soq-${pad3(n)}-<employer>-<date>.pdf`);
  const finalPath = join(outDir, basename(finalName));
  const draftPath = join(outDir, `.soq-draft-${randomUUID()}.pdf`);

  const renderHtmlToPdf = render || (await import("./generate-pdf.mjs")).renderHtmlToPdf;
  let result;
  try {
    // styleTokens {} keeps the CV theme (profile.yml style:) off the SOQ: the
    // posting dictates its font and size, not the candidate's CV styling.
    result = await renderHtmlToPdf(html, draftPath, { format: "letter", kind: "cover", maxPages: fmt.page_limit, strictPages: false, styleTokens: {}, workspaceRoot: root });
  } catch (err) {
    try { unlinkSync(draftPath); } catch { /* not written */ }
    throw err;
  }
  await dropDraftManifestRows(root);
  const pages = result?.pageCount ?? null;
  if (pages && pages > fmt.page_limit) {
    try { unlinkSync(draftPath); } catch { /* already gone */ }
    return { ok: false, reason: `The SOQ is ${pages} pages; the posting allows ${fmt.page_limit}. Shorten it and render again. Nothing was saved.`, pages, page_limit: fmt.page_limit, over_limit: true, fact_warnings: warnings, format: fmt };
  }
  renameSync(draftPath, finalPath);
  return { ok: true, path: finalPath, file: basename(finalPath), pages, page_limit: fmt.page_limit, over_limit: false, fact_warnings: warnings, format: fmt };
}

/**
 * The PDF renderer records every render in data/pdf-index.tsv. An SOQ is found
 * by its file name, not by that index, and it renders to a draft name first,
 * so its row would point at a file that no longer exists. Drop those rows.
 */
async function dropDraftManifestRows(root) {
  let manifest;
  try {
    manifest = resolvePdfIndexPath(resolveTrackerPath(root));
  } catch {
    return;
  }
  if (!existsSync(manifest)) return;
  try {
    await withPipelineLock(manifest, () => {
      const text = readFileSync(manifest, "utf-8");
      const eol = text.includes("\r\n") ? "\r\n" : "\n";
      const kept = text.split(/\r?\n/).filter((line) => !/(^|[\t\\/])\.soq-draft-[0-9a-f-]+\.pdf(\t|$)/i.test(line));
      const next = kept.join(eol);
      if (next !== text) writeFileSync(manifest, next);
    });
  } catch {
    /* bookkeeping only */
  }
}

// ---------------------------------------------------------------------------
// CLI

async function main() {
  const { values: args } = parseArgs({
    options: {
      payload: { type: "string" },
      instructions: { type: "string" },
      find: { type: "string" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: false,
  });
  const root = getCareerOpsRoot();

  if (args.instructions) {
    const file = resolve(args.instructions);
    const text = readFileSync(file, "utf-8");
    console.log(JSON.stringify(extractSoqInstructions(/\.md$/i.test(file) ? jdTextFromReport(text) : text), null, 2));
    return;
  }
  if (args.find) {
    const hit = findDoc(root, "soq", args.find);
    console.log(JSON.stringify({ tracker: args.find, path: hit }));
    process.exit(hit ? 0 : 1);
  }
  if (args.help || !args.payload) {
    console.log(`Usage:
  node generate-soq.mjs --payload soq.json [--out soq-NNN-employer-YYYY-MM-DD.pdf]
  node generate-soq.mjs --instructions reports/NNN-....md
  node generate-soq.mjs --find <tracker#>`);
    process.exit(args.help ? 0 : 1);
  }
  const payload = JSON.parse(readFileSync(resolve(args.payload), "utf-8"));
  try {
    const result = await renderSoq(payload, { root, outName: args.out ? basename(args.out) : undefined });
    for (const w of result.fact_warnings) console.error(w);
    console.log(JSON.stringify(result));
    process.exit(result.ok ? 0 : 3);
  } catch (err) {
    console.error(`ERROR generating SOQ: ${err.message}`);
    console.log(JSON.stringify({ ok: false, reason: err.message }));
    process.exit(1);
  }
}

if (isMainModule(import.meta.url)) main();
