// @ts-check
import { decodeEntities } from './_html-entities.mjs';
import { sleep } from './_http.mjs';
import { htmlToText } from './_html-to-text.mjs';
import { classifyRemoteScope } from './_remote-scope.mjs';
/** @typedef {import('./_types.js').Provider} Provider */

// Remote.co provider — polite HTML read of public category listing pages
// (https://remote.co/remote-jobs/{category}/).
//
// Wire in via a `job_boards:` entry with `provider: remoteco` and an optional
// `categories:` list of slugs (default: operations, project-manager,
// accounting, finance). Rules this provider keeps:
//   - robots.txt is read first; if it cannot be read, or it disallows the
//     listing path for `User-agent: *`, the provider throws and the board
//     reports an error instead of scanning.
//   - one request at a time, at least `delay_ms` (default 4000) apart.
//   - the shared career-ops User-Agent only; no browser impersonation and no
//     attempt to get past a bot check. A blocked site stays blocked.
//   - list pages only, no per-job fetches. Every row keeps its remote.co URL
//     (link back to the original posting).
// Remote.co is a FlexJobs property; listings that redirect into the FlexJobs
// paywall are not followed.

const HOST = 'remote.co';
const BASE = `https://${HOST}`;
const DEFAULT_CATEGORIES = ['operations', 'project-manager', 'accounting', 'finance'];
const DEFAULT_DELAY_MS = 4000;

/**
 * True when robots.txt allows `path` for `User-agent: *`. Longest matching
 * rule wins (Allow beats Disallow on a tie), per RFC 9309. Exported for tests.
 * @param {string} robots
 * @param {string} path
 */
export function robotsAllows(robots, path) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const rawLine of String(robots || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !current) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') current.rules.push({ allow: key === 'allow', path: value });
  }
  const mine = groups.filter((g) => g.agents.some((a) => a === 'career-ops'));
  const applicable = mine.length ? mine : groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const g of applicable) {
    for (const r of g.rules) {
      if (!r.path) continue;
      const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
      if (!re.test(path)) continue;
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return best ? best.allow : true;
}

function clean(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/**
 * Parse a Remote.co listing page. Prefers schema.org JobPosting JSON-LD when
 * the page carries it; otherwise reads job-card anchors that link to
 * /job/{slug}. Exported for tests.
 * @param {string} html
 */
export function parseRemoteCoListing(html) {
  const jobs = [];
  const seen = new Set();
  const push = (job) => {
    if (!job.url || !job.title || seen.has(job.url)) return;
    seen.add(job.url);
    jobs.push(job);
  };

  for (const m of String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try { data = JSON.parse(m[1]); } catch { continue; }
    const items = [].concat(data?.['@graph'] || data?.itemListElement || data || []);
    for (const raw of items) {
      const p = raw?.item || raw;
      if (!p || p['@type'] !== 'JobPosting') continue;
      const url = typeof p.url === 'string' ? safeUrl(p.url) : '';
      const location = clean([].concat(p.applicantLocationRequirements || []).map((l) => l?.name || '').join(', '));
      const description = htmlToText(String(p.description || ''));
      const job = {
        title: clean(p.title),
        company: clean(p.hiringOrganization?.name),
        url,
        location: location || 'Remote',
        remoteScope: classifyRemoteScope({ location, description, title: clean(p.title) }),
      };
      if (description) job.description = description;
      const posted = Date.parse(p.datePosted || '');
      if (!Number.isNaN(posted)) job.postedAt = posted;
      const v = p.baseSalary?.value;
      const min = Number(v?.minValue ?? v?.value);
      const max = Number(v?.maxValue ?? v?.value);
      if (String(v?.unitText || '').toUpperCase() === 'YEAR' && min >= 15000) {
        job.salary = { min, max: max || min, currency: String(p.baseSalary?.currency || 'USD').toUpperCase() };
      }
      push(job);
    }
  }
  if (jobs.length) return jobs;

  for (const m of String(html || '').matchAll(/<a\b[^>]*href="([^"]*\/job\/[^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeUrl(m[1]);
    const text = clean(m[2]);
    if (!url || !text) continue;
    // Card text is usually "Title Company Location"; the title is the first line-ish run.
    const title = text.split(/\s{2,}|\s[|•·]\s/)[0].slice(0, 160);
    push({ title, company: '', url, location: 'Remote', remoteScope: 'unknown' });
  }
  return jobs;
}

function safeUrl(href) {
  try {
    const u = new URL(href, BASE);
    if (u.protocol !== 'https:' || (u.hostname !== HOST && u.hostname !== `www.${HOST}`)) return '';
    u.hash = '';
    return u.href;
  } catch {
    return '';
  }
}

/** @param {{categories?: unknown}} entry */
export function remoteCoCategories(entry = {}) {
  const raw = Array.isArray(entry?.categories) ? entry.categories : DEFAULT_CATEGORIES;
  return [...new Set(raw.filter((c) => typeof c === 'string').map((c) => c.trim().toLowerCase()).filter((c) => /^[a-z0-9-]+$/.test(c)))];
}

/** @type {Provider} */
export default {
  id: 'remoteco',

  detect(entry) {
    return entry?.provider === 'remoteco' ? { url: `${BASE}/remote-jobs/` } : null;
  },

  async fetch(entry, ctx) {
    const delayMs = Number.isFinite(Number(entry?.delay_ms)) && Number(entry.delay_ms) >= 2000 ? Number(entry.delay_ms) : DEFAULT_DELAY_MS;

    // robots.txt first. Unreadable robots.txt = do not scan.
    const robots = await ctx.fetchText(`${BASE}/robots.txt`, { redirect: 'error' });
    const out = new Map();
    for (const slug of remoteCoCategories(entry)) {
      const path = `/remote-jobs/${slug}/`;
      if (!robotsAllows(robots, path)) {
        console.error(`remoteco: robots.txt disallows ${path}; skipped`);
        continue;
      }
      await sleep(delayMs, ctx);
      const html = await ctx.fetchText(`${BASE}${path}`, { redirect: 'error' });
      for (const job of parseRemoteCoListing(html)) if (!out.has(job.url)) out.set(job.url, job);
    }
    return [...out.values()];
  },
};
