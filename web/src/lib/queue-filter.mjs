/** Queue tracker rows: evaluated roles scoring at least 4.0, highest first. */
export function queueRows(rows, scoreNum) {
  return rows
    .filter((row) => row.status === "Evaluated" && Number.isFinite(scoreNum(row.score)) && scoreNum(row.score) >= 4)
    .slice()
    .sort((a, b) => scoreNum(b.score) - scoreNum(a.score));
}
