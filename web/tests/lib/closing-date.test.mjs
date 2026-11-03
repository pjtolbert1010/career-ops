import test from "node:test";
import assert from "node:assert/strict";
import { closingDateFromText, todayIso } from "../../src/lib/closing-date.mjs";

test("reads a NEOGOV closing date as month first", () => {
  assert.deepEqual(closingDateFromText("Opening Date\n\n10/19/2026\n\nClosing Date\n\n11/2/2026 5:00 PM Pacific"), { date: "2026-11-02", open: false });
});
test("reads CalCareers and written-out dates", () => {
  assert.equal(closingDateFromText("Final Filing Date: 11/16/2026").date, "2026-11-16");
  assert.equal(closingDateFromText("Apply by November 20, 2026.").date, "2026-11-20");
  assert.equal(closingDateFromText("Deadline: 2026-12-01").date, "2026-12-01");
});
test("flags open-until-filled postings and ignores dates with no marker", () => {
  assert.deepEqual(closingDateFromText("Posted 10/1/2026. Open until filled."), { date: null, open: true });
});
test("todayIso uses the local calendar day", () => {
  assert.equal(todayIso(new Date(2026, 10, 2, 23, 30)), "2026-11-02");
});
