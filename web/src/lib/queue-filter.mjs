/** Queue tracker rows: evaluated roles scoring at least 4.0, highest first. */
export function queueRows(rows, scoreNum) {
  return rows
    .filter((row) => row.status === "Evaluated" && Number.isFinite(scoreNum(row.score)) && scoreNum(row.score) >= 4)
    .slice()
    .sort((a, b) => scoreNum(b.score) - scoreNum(a.score));
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
