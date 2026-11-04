#!/usr/bin/env node
/**
 * export-cvs.mjs — copy every tailored CV into one folder for a companion
 * client (another assistant reading files, a browser extension).
 *
 *   node export-cvs.mjs            # export now
 *   node export-cvs.mjs --auto     # export only when config/profile.yml turns it on
 *   node export-cvs.mjs --json     # print the result as JSON
 *
 * Each tracker row whose report has a CV in data/pdf-index.tsv (still on disk)
 * is copied as {id}-{company}-{job-title}.pdf, where id is the tracker # (the
 * /pipeline/:id of the dashboard), and manifest.json lists every file with its
 * job title and job URL. The folder only gains or refreshes the files this
 * script names: nothing in it is deleted.
 *
 * Folder: CAREER_OPS_CV_EXPORT_DIR, else `cv_export.dir` in config/profile.yml
 * (a leading ~ is the home folder), else ~/Desktop/Tailored-CVs.
 * generate-pdf.mjs runs the export after each CV it renders when
 * config/profile.yml sets `cv_export.auto: true`. The dashboard's
 * /api/pipeline/export-all route uses this module too, so both write the
 * same names.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, resolve } from 'path';
import { resolveColumns, parseTrackerRow, extractTrackerReportNumbers, reportUrlForNumbers } from './tracker-parse.mjs';
import { resolvePdfIndexPath, resolveWorkspaceRootFor } from './tracker-utils.mjs';
import { parsePdfIndex, livePdfIndex, normNum } from './find.mjs';
import { getCareerOpsRoot, getProfilePath, hasProfileOverride, resolveTrackerPath } from './path-resolver.mjs';
import { loadYaml } from './lib/yaml-document.mjs';
import { isMainModule } from './lib/is-main-module.mjs';

/** ASCII words joined by "-", capped so the file name stays a sane length. */
function slug(s, max) {
  const out = (String(s ?? '').toLowerCase().match(/[a-z0-9]+/g) ?? []).join('-');
  return (out.length > max ? out.slice(0, max).replace(/-[^-]*$/, '') : out) || 'untitled';
}

export function exportFileName(id, company, title) {
  return `${id}-${slug(company, 40)}-${slug(title, 60)}.pdf`;
}

function profileSettings(root) {
  try {
    // CAREER_OPS_PROFILE names the profile every other reader uses; honor it
    // over the data root's own copy, as generate-pdf.mjs does.
    const profile = loadYaml(readFileSync(hasProfileOverride() ? getProfilePath() : getProfilePath(root), 'utf-8'));
    const s = profile && typeof profile === 'object' ? profile.cv_export : null;
    return s && typeof s === 'object' ? s : {};
  } catch {
    return {};
  }
}

const expandHome = (p) => (p === '~' || /^~[\\/]/.test(p) ? join(homedir(), p.slice(1)) : p);

export function exportDir(root = getCareerOpsRoot()) {
  const fromEnv = process.env.CAREER_OPS_CV_EXPORT_DIR?.trim();
  if (fromEnv) return resolve(expandHome(fromEnv));
  const fromProfile = profileSettings(root).dir;
  if (typeof fromProfile === 'string' && fromProfile.trim()) return resolve(root, expandHome(fromProfile.trim()));
  return join(homedir(), 'Desktop', 'Tailored-CVs');
}

export function autoExportEnabled(root = getCareerOpsRoot()) {
  return profileSettings(root).auto === true;
}

/**
 * Every tracker row, with its tailored CV (absolute path) when it has one.
 * @returns {{ record: { id: string, company: string, job_title: string, job_url: string|null, status: string, cv_file: string|null }, pdf: string|null }[]}
 */
export function exportRecords(root = getCareerOpsRoot()) {
  const trackerPath = resolveTrackerPath(root);
  if (!existsSync(trackerPath)) return [];
  const lines = readFileSync(trackerPath, 'utf-8').split('\n');
  const colmap = resolveColumns(lines);
  const indexPath = resolvePdfIndexPath(trackerPath);
  const index = existsSync(indexPath) ? livePdfIndex(parsePdfIndex(readFileSync(indexPath, 'utf-8')), root) : new Map();
  const workspace = resolveWorkspaceRootFor(root);
  const reportsDir = join(root, 'reports');
  const out = [];
  for (const line of lines) {
    const row = parseTrackerRow(line, colmap);
    if (!row) continue;
    const id = String(row.num);
    const reportNums = extractTrackerReportNumbers(row.report).map(normNum);
    const rel = reportNums.map((n) => index.get(n)).find(Boolean) ?? null;
    const pdf = rel ? resolve(workspace, rel) : null;
    const url = row.url || reportUrlForNumbers(reportNums.length ? reportNums : [id], reportsDir, (u) => /^https?:\/\//i.test(u));
    out.push({
      record: { id, company: row.company, job_title: row.role, job_url: url || null, status: row.status, cv_file: pdf ? exportFileName(id, row.company, row.role) : null },
      pdf,
    });
  }
  return out;
}

/** Copy every tailored CV into the export folder and write manifest.json beside them. */
export function writeExport(root = getCareerOpsRoot(), dir = exportDir(root)) {
  mkdirSync(dir, { recursive: true });
  const files = [];
  for (const { record, pdf } of exportRecords(root)) {
    if (!pdf || !record.cv_file) continue;
    copyFileSync(pdf, join(dir, record.cv_file));
    files.push({ file: record.cv_file, id: record.id, company: record.company, job_title: record.job_title, job_url: record.job_url });
  }
  const manifest = join(dir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({ generated: new Date().toISOString(), files }, null, 2) + '\n', 'utf8');
  return { dir, manifest, files };
}

if (isMainModule(import.meta.url)) {
  const args = process.argv.slice(2);
  const root = getCareerOpsRoot();
  if (args.includes('--auto') && !autoExportEnabled(root)) {
    if (args.includes('--json')) console.log(JSON.stringify({ skipped: 'cv_export.auto is not true in config/profile.yml' }));
    process.exit(0);
  }
  const result = writeExport(root);
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else console.log(`📤 ${result.files.length} tailored CVs exported to ${result.dir} (manifest: ${result.manifest})`);
}
