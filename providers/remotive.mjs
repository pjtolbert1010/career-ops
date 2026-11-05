// @ts-check
import { htmlToText } from './_html-to-text.mjs';
import { classifyRemoteScope } from './_remote-scope.mjs';
import { parseAnnualCompensation } from './_salary-text.mjs';
/** @typedef {import('./_types.js').Provider} Provider */

// Remotive provider — board-wide aggregator feed
// (https://remotive.com/api/remote-jobs). Returns { jobs: [...] }.
//
// Wire in via a `job_boards:` entry with `provider: remotive`. Optional entry
// fields: `category` (one Remotive category slug, e.g. "business") and
// `search` (one search term). With neither, the full feed is fetched once and
// scan.mjs's title_filter does the narrowing — one request per scan.
//
// Remotive's API terms: link back to the Remotive URL and name Remotive as
// the source (every row keeps the remotive.com URL), and call the API at most
// ~4 times a day. Keep one entry rather than one per keyword so a scan stays
// a single request.

const FEED_URL = 'https://remotive.com/api/remote-jobs';

/**
 * Epoch ms for `publication_date`, or undefined when absent or unparseable.
 * The feed writes it with no offset (2026-10-27T12:56:13), which Date.parse
 * reads as the machine's local time. Read it as UTC instead, so the same row
 * gets the same age on every machine; a few hours either way doesn't move a
 * max_posting_age_days cut.
 */
export function toEpochMs(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const v = value.trim();
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(v);
  const parsed = Date.parse(/T\d/.test(v) && !hasOffset ? `${v}Z` : v);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Annual salary from Remotive's free-text `salary` ("$170k - $200k",
 * "70K-80K"). Monthly, hourly and per-task figures return undefined, as do
 * amounts under 15,000 (a monthly figure written without its period).
 * Exported for tests.
 */
export function remotiveSalary(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  if (/per task|\/task|commission only/i.test(raw)) return undefined;
  const parsed = parseAnnualCompensation(raw.replace(/\bOTE\b/i, ''));
  if (!parsed || !parsed.min || parsed.min < 15000) return undefined;
  const currency = /€|eur/i.test(raw) ? 'EUR' : /£|gbp/i.test(raw) ? 'GBP' : 'USD';
  return { min: parsed.min, max: parsed.max || parsed.min, currency };
}

/** Feed URL for an entry, with its optional category / search narrowing. */
export function remotiveFeedUrl(entry = {}) {
  const u = new URL(FEED_URL);
  if (typeof entry.category === 'string' && entry.category.trim()) u.searchParams.set('category', entry.category.trim());
  if (typeof entry.search === 'string' && entry.search.trim()) u.searchParams.set('search', entry.search.trim());
  return u.href;
}

/** @type {Provider} */
export default {
  id: 'remotive',

  /**
   * Fetches and normalizes postings from the Remotive public feed.
   * @param {{ name?: string, category?: string, search?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx - HTTP context.
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects
    const json = await ctx.fetchJson(remotiveFeedUrl(entry), { redirect: 'error' });
    if (!json || !Array.isArray(json.jobs)) {
      throw new Error(`remotive: unexpected API response — expected { jobs: [...] }, got keys: [${json ? Object.keys(json).join(', ') : 'null'}]`);
    }

    return json.jobs
      .filter(j => j && typeof j === 'object'
        && typeof j.title === 'string' && j.title.trim() !== ''
        && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
      .map(j => {
        const location = typeof j.candidate_required_location === 'string' ? j.candidate_required_location.trim() : '';
        const description = typeof j.description === 'string' ? htmlToText(j.description) : '';
        /** @type {any} */
        const job = {
          title: j.title.trim(),
          url: j.url.trim(),
          company: typeof j.company_name === 'string' && j.company_name.trim() ? j.company_name.trim() : (entry.name || 'Remotive'),
          location,
          remoteScope: classifyRemoteScope({ location, description, title: j.title }),
        };
        if (description) job.description = description;
        const salary = remotiveSalary(j.salary);
        if (salary) job.salary = salary;
        const postedAt = toEpochMs(j.publication_date);
        if (postedAt !== undefined) job.postedAt = postedAt;
        return job;
      });
  },
};
