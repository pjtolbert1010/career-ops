import test from "node:test";
import assert from "node:assert/strict";
import { appliedRows, queueRows } from "../../src/lib/queue-filter.mjs";

const scoreNum = (score) => Number.parseFloat(score);

test("queue excludes scores below 4.0", () => {
  assert.deepEqual(queueRows([{ status: "Evaluated", score: "3.9" }, { status: "Evaluated", score: "4.0" }], scoreNum).map((r) => r.score), ["4.0"]);
});
test("queue sorts scores descending", () => {
  assert.deepEqual(queueRows([{ status: "Evaluated", score: "4.1" }, { status: "Evaluated", score: "4.8" }], scoreNum).map((r) => r.score), ["4.8", "4.1"]);
});
test("queue excludes non-Evaluated rows", () => {
  assert.deepEqual(queueRows([{ status: "Applied", score: "5.0" }, { status: "Evaluated", score: "4.2" }], scoreNum).map((r) => r.status), ["Evaluated"]);
});
test("queue breaks score ties by soonest closing date, undated last", () => {
  const rows = [
    { n: "1", status: "Evaluated", score: "4.2" },
    { n: "2", status: "Evaluated", score: "4.2", closes: "2026-11-20" },
    { n: "3", status: "Evaluated", score: "4.2", closes: "2026-11-05" },
    { n: "4", status: "Evaluated", score: "4.5", closes: "2026-12-01" },
  ];
  assert.deepEqual(queueRows(rows, scoreNum, "2026-11-02").map((r) => r.n), ["4", "3", "2", "1"]);
});
test("queue hides postings whose closing date has passed, keeps today's", () => {
  const rows = [
    { n: "1", status: "Evaluated", score: "4.2", closes: "2026-11-01" },
    { n: "2", status: "Evaluated", score: "4.2", closes: "2026-11-02" },
  ];
  assert.deepEqual(queueRows(rows, scoreNum, "2026-11-02").map((r) => r.n), ["2"]);
});
test("applied keeps sent applications, newest first", () => {
  const rows = [
    { n: "1", status: "Applied", date: "2026-10-01" },
    { n: "2", status: "Evaluated", date: "2026-10-05" },
    { n: "3", status: "Interview", date: "2026-10-03" },
    { n: "4", status: "Rejected", date: "2026-10-04" },
  ];
  assert.deepEqual(appliedRows(rows).map((r) => r.n), ["3", "1"]);
});
