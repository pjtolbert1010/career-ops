import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { exportFileName, exportDir, autoExportEnabled, exportRecords, writeExport } from '../export-cvs.mjs';

function fixture({ profile = '' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cvexport-'));
  for (const d of ['data', 'reports', 'output', 'config']) mkdirSync(join(root, d));
  writeFileSync(join(root, 'data', 'applications.md'), [
    '# Applications Tracker', '',
    '| # | Date | Company | Role | Score | Status | PDF | Report | Notes |',
    '|---|------|---------|------|-------|--------|-----|--------|-------|',
    '| 7 | 2026-11-01 | Acme & Co. | Senior Analyst (Contracts) | 4.2/5 | Evaluated | ✅ | [007](../reports/007-acme-2026-11-01.md) | |',
    '| 8 | 2026-11-01 | Beta | Analyst | 4.0/5 | Evaluated | ❌ | [008](../reports/008-beta-2026-11-01.md) | |',
    '| 9 | 2026-11-01 | Gone | Analyst | 4.0/5 | Evaluated | ✅ | [009](../reports/009-gone-2026-11-01.md) | |',
  ].join('\n') + '\n');
  writeFileSync(join(root, 'reports', '007-acme-2026-11-01.md'), '# Acme\n\n**URL:** https://jobs.example.com/acme/7\n');
  writeFileSync(join(root, 'reports', '008-beta-2026-11-01.md'), '# Beta\n\n**URL:** <https://jobs.example.com/beta/8>\n');
  writeFileSync(join(root, 'output', 'cv-me-007-acme.pdf'), '%PDF-1.4 acme');
  writeFileSync(join(root, 'data', 'pdf-index.tsv'), [
    '# report\tpdf\thtml\tformat\tdate\tkind',
    '007\toutput/cv-me-007-acme.pdf\toutput/cv-me-007-acme.html\tletter\t2026-11-01\tcv',
    '007\toutput/cover-acme.pdf\toutput/cover-acme.html\tletter\t2026-11-01\tcover',
    '009\toutput/cv-me-009-gone.pdf\toutput/cv-me-009-gone.html\tletter\t2026-11-01\tcv',
  ].join('\n') + '\n');
  writeFileSync(join(root, 'config', 'profile.yml'), profile);
  return root;
}

test('file names are {id}-{company}-{job-title}.pdf in safe ASCII', () => {
  assert.equal(exportFileName('7', 'Acme & Co.', 'Senior Analyst (Contracts)'), '7-acme-co-senior-analyst-contracts.pdf');
  assert.equal(exportFileName('3', '', '日本'), '3-untitled-untitled.pdf');
  assert.ok(exportFileName('1', 'x'.repeat(100), 'y'.repeat(100)).length < 110);
});

test('records list every row; only rows with a CV still on disk get a file', () => {
  const root = fixture();
  const recs = exportRecords(root).map((r) => r.record);
  assert.deepEqual(recs.map((r) => [r.id, r.cv_file, r.job_url]), [
    ['7', '7-acme-co-senior-analyst-contracts.pdf', 'https://jobs.example.com/acme/7'],
    ['8', null, 'https://jobs.example.com/beta/8'],
    ['9', null, null],
  ]);
});

test('writeExport copies CVs and writes the manifest, deleting nothing', () => {
  const root = fixture();
  const dir = join(root, 'export', 'nested');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'keep-me.txt'), 'mine');
  const res = writeExport(root, dir);
  assert.deepEqual(readdirSync(dir).sort(), ['7-acme-co-senior-analyst-contracts.pdf', 'keep-me.txt', 'manifest.json']);
  assert.equal(readFileSync(join(dir, '7-acme-co-senior-analyst-contracts.pdf'), 'utf8'), '%PDF-1.4 acme');
  const m = JSON.parse(readFileSync(res.manifest, 'utf8'));
  assert.deepEqual(m.files, [{ file: '7-acme-co-senior-analyst-contracts.pdf', id: '7', company: 'Acme & Co.', job_title: 'Senior Analyst (Contracts)', job_url: 'https://jobs.example.com/acme/7' }]);
  writeExport(root, dir);
  assert.ok(existsSync(join(dir, 'keep-me.txt')));
});

test('folder and auto flag come from env, then profile, then the default', () => {
  const saved = process.env.CAREER_OPS_CV_EXPORT_DIR;
  delete process.env.CAREER_OPS_CV_EXPORT_DIR;
  try {
    const plain = fixture();
    assert.equal(exportDir(plain), join(homedir(), 'Desktop', 'Tailored-CVs'));
    assert.equal(autoExportEnabled(plain), false);
    const on = fixture({ profile: 'cv_export:\n  auto: true\n  dir: "~/Somewhere/CVs"\n' });
    assert.equal(exportDir(on), join(homedir(), 'Somewhere', 'CVs'));
    assert.equal(autoExportEnabled(on), true);
    assert.equal(autoExportEnabled(fixture({ profile: 'cv_export:\n  auto: "yes"\n' })), false);
    process.env.CAREER_OPS_CV_EXPORT_DIR = join(tmpdir(), 'from-env');
    assert.equal(exportDir(on), join(tmpdir(), 'from-env'));
  } finally {
    if (saved === undefined) delete process.env.CAREER_OPS_CV_EXPORT_DIR;
    else process.env.CAREER_OPS_CV_EXPORT_DIR = saved;
  }
});
