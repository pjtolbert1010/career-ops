import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPage } from "../../src/lib/apply/match-page.mjs";

const rows = [
  { id: "38", company: "CCAH", job_title: "Analyst", job_url: "https://job-boards.greenhouse.io/ccah/jobs/8327936" },
  { id: "95", company: "DWR", job_title: "Unit Manager", job_url: "https://www.calcareers.ca.gov/CalHRPublic/Jobs/JobPosting.aspx?JobControlId=535245" },
  { id: "49", company: "Appen", job_title: "Ops", job_url: "https://jobs.lever.co/appen-2/485e29e1-f1e7-40d4-806b-c15f45d657d3" },
];

test("same posting URL matches, tracking params ignored", () => {
  assert.equal(matchPage("https://job-boards.greenhouse.io/ccah/jobs/8327936?utm_source=x", rows)?.id, "38");
});
test("application page sharing the posting id on the same site matches", () => {
  assert.equal(matchPage("https://www.calcareers.ca.gov/CalHrPublic/Jobs/Apply.aspx?JobControlId=535245&step=2", rows)?.id, "95");
  assert.equal(matchPage("https://jobs.lever.co/appen-2/485e29e1-f1e7-40d4-806b-c15f45d657d3/apply", rows)?.id, "49");
});
test("same id on another site, or no shared id, does not match", () => {
  assert.equal(matchPage("https://example.com/jobs/8327936", rows), null);
  assert.equal(matchPage("https://job-boards.greenhouse.io/ccah/jobs/1111111", rows), null);
  assert.equal(matchPage("not a url", rows), null);
});
