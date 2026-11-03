/**
 * closing-date.mjs - read a posting's closing date from its report or JD text.
 *
 * The Queue sorts by score, then by closing date, and hides postings whose
 * closing date has passed. The root closing-soon.mjs refuses numeric dates
 * like 11/2/2026 as ambiguous (MM/DD vs DD/MM). The queue reads US government
 * boards (NEOGOV, CalCareers), which always print month first, so numeric
 * dates here are read as M/D/YYYY.
 */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MARKER = /(closing date|final filing date|filing deadline|application deadline|deadline to apply|deadline|apply by|closes on|closes)\b\s*[:\-]?\s*/gi;
const OPEN = /\b(open until filled|until filled|continuous(ly)? (filing|recruitment|open)|open continuous)\b/i;

function iso(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function readDate(tail) {
  let m = tail.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = tail.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (m) return iso(+m[3], +m[1], +m[2]);
  m = tail.match(/^(?:[a-z]+,\s*)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (month >= 0) return iso(+m[3], month + 1, +m[2]);
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{ date: string | null, open: boolean }} the latest closing date
 *   found after a closing-date marker (ISO YYYY-MM-DD), and whether the text
 *   says the posting is open until filled.
 */
export function closingDateFromText(text) {
  const source = String(text ?? "").replace(/\s+/g, " ");
  let date = null;
  MARKER.lastIndex = 0;
  let match;
  while ((match = MARKER.exec(source)) !== null) {
    const found = readDate(source.slice(match.index + match[0].length, match.index + match[0].length + 40));
    if (found && (!date || found > date)) date = found;
  }
  return { date, open: OPEN.test(source) };
}

/** Today as a local-calendar ISO day, the unit closing dates are compared in. */
export function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
