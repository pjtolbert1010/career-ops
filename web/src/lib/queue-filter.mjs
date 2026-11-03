import { todayIso } from "./closing-date.mjs";

/**
 * Queue tracker rows: evaluated roles scoring at least 4.0 whose posting has
 * not closed, highest score first, then soonest closing date. A row's `closes`
 * is an ISO day (set by the pipeline page from the report); rows without one
 * sort after the dated rows of the same score.
 */
export function queueRows(rows, scoreNum, today = todayIso()) {
  const closes = (row) => (typeof row.closes === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.closes) ? row.closes : "9999-12-31");
  return rows
    .filter((row) => row.status === "Evaluated" && Number.isFinite(scoreNum(row.score)) && scoreNum(row.score) >= 4 && closes(row) >= today)
    .slice()
    .sort((a, b) => scoreNum(b.score) - scoreNum(a.score) || closes(a).localeCompare(closes(b)));
}

/** Statuses that mean the application went out. */
export const APPLIED_STATUSES = ["Applied", "Responded", "Assessment", "Interview", "Offer", "Hired"];

/** Tracker rows the user has applied to, newest date first. */
export function appliedRows(rows) {
  return rows
    .filter((row) => APPLIED_STATUSES.includes(row.status))
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.n) - Number(a.n));
}
