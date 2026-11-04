// tests/generate-soq.test.mjs — reading a CalCareers posting's SOQ rules, and
// naming and building the Statement of Qualifications.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSoqHtml,
  docFileName,
  extractSoqInstructions,
  fontIn,
  isDocFor,
  jdTextFromReport,
  marginsIn,
  pageLimitIn,
  promptsIn,
  resolveFormat,
  spacingIn,
} from "../generate-soq.mjs";

test("page limits in the wordings CalCareers postings use", () => {
  assert.equal(pageLimitIn("The SOQ must be typed, no more than two pages in length"), 2);
  assert.equal(pageLimitIn("a maximum of two (2) pages in length"), 2);
  assert.equal(pageLimitIn("not to exceed 3 pages"), 3);
  assert.equal(pageLimitIn("Cover letter, not to exceed one page, explaining why"), 1);
  assert.equal(pageLimitIn("two page maximum"), 2);
  assert.equal(pageLimitIn("Please describe your experience."), null);
});

test("font and point size, in either order", () => {
  assert.deepEqual(fontIn("no more than two pages in length, and 12-point Arial font."), { font: "Arial", size_pt: 12 });
  assert.deepEqual(fontIn("typed in 12 - point Arial font"), { font: "Arial", size_pt: 12 });
  assert.deepEqual(fontIn("Responses must be in Arial font size 11"), { font: "Arial", size_pt: 11 });
  assert.deepEqual(fontIn("Times New Roman, size 12"), { font: "Times New Roman", size_pt: 12 });
  assert.deepEqual(fontIn("single-spaced, and 12-point font."), { font: null, size_pt: 12 });
  assert.deepEqual(fontIn("Call (916) 445-1234"), { font: null, size_pt: null });
});

test("margins and spacing", () => {
  assert.equal(marginsIn("with one inch margins"), 1);
  assert.equal(marginsIn("with margins not less than one inch"), 1);
  assert.equal(marginsIn("no margins stated"), null);
  assert.equal(spacingIn("single-spaced"), 1);
  assert.equal(spacingIn("double spaced"), 2);
  assert.equal(spacingIn("nothing"), null);
});

test("numbered prompts start at 1 and count up; stray numbers start nothing", () => {
  const prompts = promptsIn(
    "Each question must be numbered. 12-point Arial. 1. Please describe your experience with contracts. 2. Describe examples of interpreting statutes. 3. Explain how you set performance standards. Possession of Minimum Qualifications will be verified.",
  );
  assert.equal(prompts.length, 3);
  assert.equal(prompts[0].prompt, "Please describe your experience with contracts.");
  assert.equal(prompts[2].prompt, "Explain how you set performance standards.");
  assert.deepEqual(promptsIn("Room 2. Floor 5. Suite 3."), []);
});

const POSTING = `Job Posting: Branch Chief JC-123456 Required Application Package Documents The following items are required to be submitted with your application. Resume is optional. It may be included, but is not required. Statement of Qualifications - Statement of Qualifications (SOQ) is required. Please see the Special Requirements section for SOQ instructions. Applicants requiring reasonable accommodations for the hiring interview process must request them. Desirable Qualifications Experience leading teams. Special Requirements The Statement of Qualifications (SOQ) serves as documentation of each applicant's ability to present information clearly. Each question must be numbered and addressed in the same order as the questions below. The SOQ must be typed, no more than two pages in length, and 12-point Arial font. 1. Please describe in detail your experience related to the duties. 2. Please describe specific examples of your ability to interpret statutes. Possession of Minimum Qualifications will be verified prior to interview. Application Instructions Completed applications must be received by the Final Filing Date.`;

test("a CalCareers posting that requires an SOQ: rules from Special Requirements, not the documents list", () => {
  const r = extractSoqInstructions(POSTING);
  assert.equal(r.soq_required, true);
  assert.equal(r.cover_letter_required, false);
  assert.equal(r.resume, "optional");
  assert.deepEqual(r.format, { font: "Arial", size_pt: 12, margins_in: null, line_spacing: null, page_limit: 2 });
  assert.equal(r.numbered, true);
  assert.equal(r.prompts.length, 2);
  assert.match(r.instructions, /^Statement of Qualifications \(SOQ\) serves/);
  assert.doesNotMatch(r.instructions, /Application Instructions Completed/);
});

test("a CalCareers posting that asks for a one-page cover letter and no SOQ", () => {
  const r = extractSoqInstructions(
    "Required Application Package Documents Resume is optional. Other - Cover letter, not to exceed one page, explaining why you are interested in this opportunity. Applicants requiring reasonable accommodations must ask. Later: Cover Letters, Resumes, Statement of Qualifications, etc. DO NOT replace the required STD. 678.",
  );
  assert.equal(r.soq_required, false);
  assert.equal(r.cover_letter_required, true);
  assert.equal(r.cover_letter_page_limit, 1);
  assert.equal(r.instructions, "");
});

test("jdTextFromReport takes the archived JD section only", () => {
  const md = "# Report\n\n## A) Fit\nx\n\n## Job Description (archived verbatim)\n\nThe posting text.\n\n## Machine Summary\nyaml";
  assert.equal(jdTextFromReport(md).trim(), "The posting text.");
  assert.equal(jdTextFromReport("no sections"), "no sections");
});

test("documents are named and found by tracker row number", () => {
  assert.equal(docFileName("soq", "95", "Department of Water Resources", "2026-11-04"), "soq-095-department-of-water-resources-2026-11-04.pdf");
  assert.equal(docFileName("cover", "7", "Acme, Inc.", "2026-11-04", "Senior Analyst"), "cover-007-acme-inc-senior-analyst-2026-11-04.pdf");
  assert.equal(isDocFor("soq-095-department-of-water-resources-2026-11-04.pdf", "soq", "95"), true);
  assert.equal(isDocFor("soq-095-department-of-water-resources-2026-11-04.pdf", "soq", "9"), false);
  assert.equal(isDocFor("soq-095-x-2026-11-04.pdf", "cover", "95"), false);
  assert.equal(isDocFor("cover-elk-grove-management-analyst-2026-10-30.pdf", "cover", "11"), false);
  assert.throws(() => docFileName("cv", "1", "x", "2026-01-01"));
});

test("the SOQ HTML follows the format and escapes the text", () => {
  const html = buildSoqHtml({
    candidate: { name: "Pat <T>" },
    posting: { title: "Analyst", jc: "JC-1" },
    format: { font: "Times New Roman", size_pt: 11, margins_in: 1, page_limit: 2, header_align: "right" },
    items: [{ number: 1, prompt: "Describe <x>.", response: ["I did & said."] }],
  });
  assert.match(html, /--page-margin: 1in/);
  assert.match(html, /font-size: 11pt/);
  assert.match(html, /"Times New Roman"/);
  assert.match(html, /text-align: right/);
  assert.match(html, /Pat &lt;T&gt;/);
  assert.match(html, /I did &amp; said\./);
  assert.throws(() => buildSoqHtml({ candidate: { name: "x" }, items: [] }), /items/);
});

test("unstated or out-of-range format values fall back to the defaults", () => {
  const f = resolveFormat({ font: "Comic Sans", size_pt: 40, page_limit: 0 });
  assert.equal(f.font, "Arial");
  assert.equal(f.size_pt, 12);
  assert.equal(f.page_limit, 2);
  assert.equal(f.margins_in, 1);
});

// JC-535245 (DWR): the SOQ is called a "Supplemental Questionnaire", the
// required-documents list only points to Special Instructions, and the
// numbered questions sit at the very end of the posting.
const DWR = `Required Application Package Documents The following items are required to be submitted with your application. Resume is optional. It may be included, but is not required. Other - See Supplemental Questionnaire information under Special Instructions below. Other - Cover Letter Applicants requiring reasonable accommodations for the hiring interview process must request the necessary accommodations. Desirable Qualifications The ideal candidate would possess experience leading and developing staff. Special Instructions To be considered, submit a completed State application (STD. 678), cover letter, and Supplemental Questionnaire. The Supplemental Questionnaire is designed to elicit information regarding each applicant's abilities. Please limit your answer to two pages maximum (Arial 12 pt font and 1” margins). 1. Describe your experience leading organizational change initiatives and implementing process improvements. 2. Describe your experience managing contracts, monitoring deliverables, and ensuring compliance with policies and procedures. 3. Describe your supervisory experience, including workload management, staff development, and performance evaluations. The following basis of eligibility will be considered: List eligibility, transfer, LEAP, reinstatement, and SROA/Surplus.`;

test("a written Supplemental Questionnaire under Special Instructions is an SOQ", () => {
  const r = extractSoqInstructions(DWR);
  assert.equal(r.soq_required, true);
  assert.equal(r.soq_named_as, "Supplemental Questionnaire");
  assert.equal(r.cover_letter_required, true);
  assert.deepEqual(r.format, { font: "Arial", size_pt: 12, margins_in: 1, line_spacing: null, page_limit: 2 });
  assert.equal(r.prompts.length, 3);
  assert.equal(r.prompts[2].prompt, "Describe your supervisory experience, including workload management, staff development, and performance evaluations.");
});

test("an online Supplemental Questionnaire with no written format is not an SOQ", () => {
  const r = extractSoqInstructions("Required Application Package Documents Resume is required. Other - Cover Letter Applicants requiring reasonable accommodations. Special Instructions Applicants must complete the online Supplemental Questionnaire at the link provided. Contact Information");
  assert.equal(r.soq_required, false);
  assert.equal(r.soq_named_as, null);
});
