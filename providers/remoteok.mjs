// @ts-check
import { htmlToText } from './_html-to-text.mjs';
import { classifyRemoteScope } from './_remote-scope.mjs';
/** @typedef {import('./_types.js').Provider} Provider */

// RemoteOK provider — board-wide aggregator feed (https://remoteok.com/api).
// Returns the latest ~100 remote postings as a JSON array; index 0 is a
// {last_updated, legal} metadata object and is skipped. scan.mjs applies the
// configured title_filter / location_filter / remote_scope_filter to the rows.
//
// Wire in via a `job_boards:` entry with `provider: remoteok`.
// RemoteOK API ToS: link back to the Remote OK URL and name "Remote OK" as the
// source. Every row keeps the remoteok.com posting URL as `url` and carries
// `source: "Remote OK"` attribution; the logo is never used (trademark).
// One request per scan.

const FEED_URL = 'https://remoteok.com/api';

/** Epoch ms for a feed date string, or undefined when absent or unparseable. */
function toEpochMs(value) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Date.parse(value.trim());
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Annual USD salary from salary_min / salary_max. RemoteOK writes 0 for
 * "not given", and some posters type a monthly figure into the yearly field
 * (4000/4000), so anything under 15,000 is treated as not annual and dropped
 * rather than read as a $4K salary. Exported for tests.
 * @returns {{min: number, max: number, currency: string} | undefined}
 */
export function remoteOkSalary(rawMin, rawMax) {
  const lo = Number(rawMin) || 0;
  const hi = Number(rawMax) || 0;
  const min = lo || hi;
  const max = hi || lo;
  if (!min || !max || Math.min(min, max) < 15000) return undefined;
  return { min: Math.min(min, max), max: Math.max(min, max), currency: 'USD' };
}

/** @type {Provider} */
export default {
  id: 'remoteok',

  /**
   * Fetches and normalizes postings from the RemoteOK public feed.
   * @param {{ name?: string }} entry - The job_boards entry being processed.
   * @param {{ fetchJson: (url: string, opts?: { redirect?: 'error'|'follow'|'manual' }) => Promise<any> }} ctx - HTTP context.
   */
  async fetch(entry, ctx) {
    // redirect:'error' prevents SSRF via server-side redirects
    const data = await ctx.fetchJson(FEED_URL, { redirect: 'error' });
    if (!Array.isArray(data)) {
      throw new Error(`remoteok: unexpected API response — expected a JSON array, got ${data === null ? 'null' : typeof data}`);
    }

    return data
      .filter(j => j && typeof j === 'object'
        && typeof j.position === 'string' && j.position.trim() !== ''
        && typeof j.url === 'string' && /^https?:\/\//i.test(j.url.trim()))
      .map(j => {
        const location = typeof j.location === 'string' ? j.location.trim() : '';
        const description = typeof j.description === 'string' ? htmlToText(j.description) : '';
        /** @type {any} */
        const job = {
          title: j.position.trim(),
          url: j.url.trim(),
          company: typeof j.company === 'string' && j.company.trim() ? j.company.trim() : (entry.name || 'RemoteOK'),
          location,
          remoteScope: classifyRemoteScope({ location, description, title: j.position }),
        };
        if (description) job.description = description;
        const salary = remoteOkSalary(j.salary_min, j.salary_max);
        if (salary) job.salary = salary;
        // `date` is ISO 8601 with an offset; without it max_posting_age_days
        // can't judge the row.
        const postedAt = toEpochMs(j.date);
        if (postedAt !== undefined) job.postedAt = postedAt;
        return job;
      });
  },
};
