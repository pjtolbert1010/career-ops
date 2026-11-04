// Which pipeline job a page in the user's browser belongs to, for the
// career-ops extension when the user turns it on in a tab the dashboard did not
// open. Same posting URL first; otherwise the same site and a posting id the
// two URLs share (a 5+ digit number such as CalCareers' JobControlId, or a
// UUID such as Lever's and Ashby's), so an application page reached from the
// posting still matches.
//
// Some application pages carry no posting id in their URL (CalCareers' Apply
// Now is a postback, so its application pages lose JobControlId). For those
// the caller may pass a hint: text read off the page, such as its job number
// ("JC-537496") and job title. A posting id in the hint matches on the same
// site; failing that, a job title found in the hint matches only when exactly
// one pipeline job on that site has a title the hint contains. Nothing else
// counts: a wrong match would attach another job's tailored CV.
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
const words = (t) => ` ${String(t).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
const MAX_HINT = 4000;

/**
 * @param {string} pageUrl
 * @param {{ id: string, company: string, job_title: string, job_url: string | null }[]} records
 * @param {string} [hint] text read off the page: its job number and title
 * @returns {{ id: string, company: string, job_title: string, via: "url" | "id" | "hint-id" | "hint-title" } | null}
 */
export function matchPage(pageUrl, records, hint = "") {
  const key = normalizeUrl(pageUrl);
  if (!key) return null;
  const exact = records.find((r) => r.job_url && normalizeUrl(r.job_url) === key);
  if (exact) return { ...exact, via: "url" };
  const host = site(pageUrl);
  const onSite = records.filter((r) => r.job_url && site(r.job_url) === host);
  const byIds = (want) => {
    if (!want.size) return null;
    const hits = onSite.filter((r) => [...ids(r.job_url)].some((i) => want.has(i)));
    // Two rows sharing the id (a re-evaluation of the same posting) are the
    // same job; pick the newest row. Different jobs can't share both.
    return hits.length ? hits[hits.length - 1] : null;
  };
  const viaUrl = byIds(ids(pageUrl));
  if (viaUrl) return { ...viaUrl, via: "id" };

  const text = String(hint || "").slice(0, MAX_HINT);
  if (!text.trim()) return null;
  const viaHint = byIds(ids(text));
  if (viaHint) return { ...viaHint, via: "hint-id" };
  const said = words(text);
  const titled = onSite.filter((r) => words(r.job_title).trim().length >= 6 && said.includes(words(r.job_title)));
  // One job, maybe evaluated twice: same title and company on every hit.
  const same = titled.every((r) => words(r.job_title) === words(titled[0].job_title) && words(r.company) === words(titled[0].company));
  return titled.length && same ? { ...titled[titled.length - 1], via: "hint-title" } : null;
}
