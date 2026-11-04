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

const sameSite = [
  { id: "23", company: "Solano County", job_title: "Staff Analyst (Senior)", job_url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5481071/staff-analyst-senior" },
  { id: "43", company: "Solano County", job_title: "Staff Analyst", job_url: "https://www.governmentjobs.com/careers/solanocounty/jobs/5536680/staff-analyst" },
  { id: "102", company: "Department of Public Health", job_title: "Strategic Projects Specialist (Health Program Specialist I)", job_url: "https://www.calcareers.ca.gov/CalHRPublic/Jobs/JobPosting.aspx?JobControlId=537496" },
  { id: "95", company: "DWR", job_title: "Unit Manager", job_url: "https://www.calcareers.ca.gov/CalHRPublic/Jobs/JobPosting.aspx?JobControlId=535245" },
];
const appPage = "https://www.calcareers.ca.gov/CalHrPublic/Applicant/ApplicationPackage.aspx";

test("an application page with no id in its URL matches on the job number read off the page", () => {
  const hit = matchPage(appPage, sameSite, "Application for JC-537496 Strategic Projects Specialist");
  assert.equal(hit?.id, "102");
  assert.equal(hit?.via, "hint-id");
});
test("a job number in the hint never matches another site's job", () => {
  assert.equal(matchPage("https://example.com/apply", sameSite, "JC-537496"), null);
});
test("a title in the hint matches only when one job on the site has it", () => {
  const hit = matchPage(appPage, sameSite, "Strategic Projects Specialist (Health Program Specialist I) — Department of Public Health");
  assert.equal(hit?.id, "102");
  assert.equal(hit?.via, "hint-title");
  // "Staff Analyst (Senior)" also contains "Staff Analyst": two jobs, no match.
  assert.equal(matchPage("https://www.governmentjobs.com/applications/apply", sameSite, "Apply: Staff Analyst (Senior)"), null);
});
test("no hint, or a hint naming nothing in the pipeline, matches nothing", () => {
  assert.equal(matchPage(appPage, sameSite), null);
  assert.equal(matchPage(appPage, sameSite, "Employment History"), null);
});
test("a URL match says how it matched", () => {
  assert.equal(matchPage(sameSite[2].job_url, sameSite)?.via, "url");
  assert.equal(matchPage("https://www.calcareers.ca.gov/CalHrPublic/Jobs/Apply.aspx?JobControlId=535245", sameSite)?.via, "id");
});
