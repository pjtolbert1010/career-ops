#!/usr/bin/env node
/**
 * docs-due.mjs — which tracked jobs still need application documents made.
 *
 * Read-only and zero-LLM. It decides; it never writes a document. The
 * queue-feeder scheduled task runs it each pass and makes whatever it lists
 * (pdf mode for the CV, generate-cover-letter.mjs / generate-soq.mjs for the
 * rest), so new evaluations get their documents without anyone asking.
 *
 * Rule (the user's, 2026-11-05): every job scoring 3.5 or higher gets its
 * documents ready for upload: the tailored CV, plus the SOQ when the posting
 * asks for one and a cover letter otherwise (both when it asks for both).
 * Remote jobs come first in the list, then by score, so a run that cannot
 * finish everything makes the remote ones. Only rows with status Evaluated
 * count: an applied or discarded job needs nothing new. Threshold override:
 * --min 3.5.
 *
 * "Remote" means the job is worked fully remotely. It is read from the
 * report's own location lines (the "Work mode" table row, **Location:**,
 * posting_location, "Work model:", "Telework:"). Hybrid or in-office wording
 * there wins over the word "remote", so a hybrid state job ("Telework:
 * Hybrid") is not remote. No location line at all → "unknown" (made, but
 * after the remote jobs).
 *
 * Where documents are found: the CV through data/pdf-index.tsv (report number,
 * the same manifest Career Reef reads); SOQ and cover letter by file name
 * prefix soq-NNN- / cover-NNN- (tracker number, generate-soq.mjs findDoc), with
 * a pdf-index "cover" row as a fallback for older covers.
 *
 * Usage:
 *   node docs-due.mjs            JSON { due: [...], skipped: [...] }
 *   node docs-due.mjs --summary  one line per job
 *   node docs-due.mjs --all      also list rows that need nothing
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCareerOpsRoot, resolveTrackerPath } from './path-resolver.mjs';
import { resolveColumns, parseTrackerRow, parseScore, linkedReportNumbers } from './tracker-parse.mjs';
import { containedReportFile, resolvePdfIndexPath } from './tracker-utils.mjs';
import { extractSoqInstructions, jdTextFromReport, findDoc } from './generate-soq.mjs';

const HYBRID = /\bhybrid\b|in[- ]office|in[- ]person|on[- ]?site|days? (a|per) week in|office days|\bin office\b|relocat/i;
const REMOTE = /\bremote\b|\bfully telework|full[- ]time telework|100% telework|work from home|\bwfh\b/i;

/** The report's location lines, in the order they are trusted. */
export function locationLines(report) {
  const out = [];
  const add = (v) => { if (v && v.trim()) out.push(v.trim()); };
  for (const m of report.matchAll(/^\|\s*Work (?:mode|model|arrangement)\s*\|([^|\n]*)\|/gim)) add(m[1]);
  for (const m of report.matchAll(/\*\*Location:\*\*([^\n]*)/g)) add(m[1]);
  for (const m of report.matchAll(/^\s*posting_location:\s*"?([^"\n]*)"?/gm)) add(m[1]);
  for (const m of report.matchAll(/^\s*(?:Work model|Work mode|Workplace type|Location type):([^\n]*)/gim)) add(m[1]);
  for (const m of report.matchAll(/Telework:\s*([^\n.;]*)/g)) add(`Telework: ${m[1]}`);
  return out;
}

/** "remote" | "hybrid" | "unknown" from a report's text. */
export function workModel(report) {
  const lines = locationLines(report);
  if (!lines.length) return 'unknown';
  if (lines.some((l) => HYBRID.test(l))) return 'hybrid';
  if (lines.some((l) => REMOTE.test(l))) return 'remote';
  // A location line that names a place but neither word: on-site by default.
  return 'hybrid';
}

function readPdfIndex(trackerPath) {
  try {
    const p = resolvePdfIndexPath(trackerPath);
    return p && existsSync(p) ? readFileSync(p, 'utf8') : '';
  } catch {
    return '';
  }
}

function indexed(indexText, reportNumber, kind, root) {
  for (const line of indexText.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const c = line.split('\t');
    if (!/^\d+$/.test(c[0] || '') || Number(c[0]) !== reportNumber) continue;
    const k = (c[5] || 'cv').trim() || 'cv';
    const isCover = k === 'cover' || /(^|\/)cover-/.test(c[1] || '');
    if ((kind === 'cover') !== isCover) continue;
    if (c[1] && existsSync(resolve(root, c[1]))) return c[1];
  }
  return null;
}

export function docsDue({ root = getCareerOpsRoot(), min = 3.5, all = false } = {}) {
  const trackerPath = resolveTrackerPath(root);
  const lines = readFileSync(trackerPath, 'utf8').split('\n');
  const colmap = resolveColumns(lines);
  const indexText = readPdfIndex(trackerPath);
  const reportsRoot = join(root, 'reports');
  const due = [];
  const skipped = [];
  for (const line of lines) {
    const row = parseTrackerRow(line, colmap);
    if (!row || row.status !== 'Evaluated') continue;
    const score = parseScore(row.score);
    if (!(score >= min)) continue;
    const reportNumber = linkedReportNumbers(row.report, row.notes)[0];
    let reportFile = null;
    try {
      reportFile = containedReportFile(row.report, reportsRoot) || null;
    } catch {
      reportFile = null;
    }
    if (!reportFile && reportNumber != null) {
      // Link written relative to data/: resolve it from the tracker's directory.
      const m = String(row.report).match(/\]\(([^)]+)\)/);
      if (m) {
        const p = resolve(dirname(trackerPath), m[1]);
        if (existsSync(p)) reportFile = p;
      }
    }
    const base = { tracker: row.num, report: reportNumber ?? null, company: row.company, role: row.role, score };
    if (!reportFile) {
      skipped.push({ ...base, reason: 'no report file' });
      continue;
    }
    const report = readFileSync(reportFile, 'utf8');
    const model = workModel(report);
    const rules = extractSoqInstructions(jdTextFromReport(report) || report);
    const have = {
      cv: reportNumber != null ? indexed(indexText, Number(reportNumber), 'cv', root) : null,
      soq: findDoc(root, 'soq', row.num),
      cover: findDoc(root, 'cover', row.num) || (reportNumber != null ? indexed(indexText, Number(reportNumber), 'cover', root) : null),
    };
    const wanted = ['cv'];
    if (rules.soq_required) wanted.push('soq');
    if (!rules.soq_required || rules.cover_letter_required) wanted.push('cover');
    const missing = wanted.filter((k) => !have[k]);
    const entry = {
      ...base,
      reportFile: reportFile.replace(/\\/g, '/').replace(root.replace(/\\/g, '/') + '/', ''),
      workModel: model,
      soqRequired: Boolean(rules.soq_required),
      coverRequired: Boolean(rules.cover_letter_required),
      wanted,
      missing,
    };
    if (missing.length) due.push(entry);
    else if (all) skipped.push({ ...entry, reason: 'all documents exist' });
  }
  const rank = (d) => (d.workModel === 'remote' ? 0 : 1);
  due.sort((a, b) => rank(a) - rank(b) || b.score - a.score || a.tracker - b.tracker);
  return { due, skipped };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('node docs-due.mjs [--summary] [--all] [--min 3.5]');
    return;
  }
  const num = (flag, d) => {
    const i = args.indexOf(flag);
    const v = i >= 0 ? Number(args[i + 1]) : NaN;
    return Number.isFinite(v) ? v : d;
  };
  const result = docsDue({ min: num('--min', 3.5), all: args.includes('--all') });
  if (!args.includes('--summary')) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (!result.due.length) console.log('Nothing due: every job that meets the rules has its documents.');
  for (const d of result.due) console.log(`#${d.tracker} ${d.company} — ${d.role} (${d.score}, ${d.workModel}): make ${d.missing.join(' + ')}`);
  for (const s of result.skipped) console.log(`  skip #${s.tracker} ${s.company} (${s.score}${s.workModel ? `, ${s.workModel}` : ''}): ${s.reason}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
