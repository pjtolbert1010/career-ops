// Which pipeline job a page in the user's browser belongs to, for the
// career-ops extension when the user turns it on in a tab the dashboard did not
// open. Same posting URL first; otherwise the same site and a posting id the
// two URLs share (a 5+ digit number such as CalCareers' JobControlId, or a
// UUID such as Lever's and Ashby's), so an application page reached from the
// posting still matches. Nothing else counts: a wrong match would attach
// another job's tailored CV.
import { normalizeUrl } from "../core/url-key.mjs";

const ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d{5,}/gi;

function site(u) {
  try {
    return new URL(u).hostname.toLowerCase().split(".").slice(-2).join(".");
  } catch {
    return "";
  }
}
const ids = (u) => new Set((String(u).match(ID) || []).map((s) => s.toLowerCase()));

/**
 * @param {string} pageUrl
 * @param {{ id: string, company: string, job_title: string, job_url: string | null }[]} records
 * @returns {{ id: string, company: string, job_title: string } | null}
 */
export function matchPage(pageUrl, records) {
  const key = normalizeUrl(pageUrl);
  if (!key) return null;
  const exact = records.find((r) => r.job_url && normalizeUrl(r.job_url) === key);
  if (exact) return exact;
  const host = site(pageUrl);
  const pageIds = ids(pageUrl);
  if (!pageIds.size) return null;
  const hits = records.filter((r) => r.job_url && site(r.job_url) === host && [...ids(r.job_url)].some((i) => pageIds.has(i)));
  // Two rows sharing the id (a re-evaluation of the same posting) are the
  // same job; pick the newest row. Different jobs can't share both.
  return hits.length ? hits[hits.length - 1] : null;
}
