import { test } from "node:test";
import assert from "node:assert/strict";
import { eeoDecline, isDecline } from "../../src/lib/apply/eeo-decline.mjs";

const DECLINE = "I choose not to identify";
const declineAll = { eeo: Object.fromEntries(["gender", "race_ethnicity", "veteran_status", "disability"].map((k) => [k, { value: DECLINE, labels: [k] }])) };
const real = { eeo: { gender: { value: "Male", labels: ["gender"] } } };

test("picks each form's own decline option", () => {
  assert.equal(eeoDecline({ type: "radio", label: "Gender:", options: ["Male", "Female", "Non-Binary", "Decline to self-identify"] }, declineAll), "Decline to self-identify");
  assert.equal(eeoDecline({ type: "select", label: "Race/Ethnicity", options: ["White", "Black", "I don't wish to answer"] }, declineAll), "I don't wish to answer");
  assert.equal(eeoDecline({ type: "radio", label: "Veteran status", options: ["I am a veteran", "I am not a veteran", "I prefer not to say"] }, declineAll), "I prefer not to say");
  assert.equal(eeoDecline({ type: "radio", label: "Do you have a disability?", options: ["Yes", "No", "I do not wish to answer"] }, declineAll), "I do not wish to answer");
});

test("checks a standalone decline checkbox (CalCareers)", () => {
  assert.equal(eeoDecline({ type: "checkbox", label: "I choose not to Identify" }, declineAll), "true");
  assert.equal(eeoDecline({ type: "checkbox", label: "White" }, declineAll), null);
  assert.equal(eeoDecline({ type: "checkbox", label: "Yes, I have a disability" }, declineAll), null);
});

test("never answers with a real value when no decline option exists", () => {
  assert.equal(eeoDecline({ type: "radio", label: "Gender:", options: ["Male", "Female", "Non-Binary"] }, declineAll), null);
  assert.equal(eeoDecline({ type: "radio", label: "Do you wish to claim Veteran's Preference?", options: ["Yes", "No"] }, declineAll), null);
});

test("leaves non-EEO questions and non-decline answers alone", () => {
  assert.equal(eeoDecline({ type: "radio", label: "Are you authorized to work in the US?", options: ["Yes", "No", "Decline to answer"] }, declineAll), null);
  assert.equal(eeoDecline({ type: "radio", label: "Gender", options: ["Male", "Decline to self-identify"] }, real), null);
  assert.equal(eeoDecline({ type: "checkbox", label: "I choose not to Identify" }, real), null);
  assert.equal(eeoDecline({ type: "checkbox", label: "I prefer not to receive marketing emails" }, declineAll), null);
  assert.equal(eeoDecline({ type: "radio", label: "Gender" }, {}), null);
});

test("recognises common decline wordings", () => {
  for (const t of ["I choose not to identify", "Decline to self identify", "I don't wish to answer", "Prefer not to say", "I do not want to self-identify", "Choose not to disclose"]) assert.ok(isDecline(t), t);
  for (const t of ["Male", "No", "I am not a veteran", "No, I do not have a disability"]) assert.ok(!isDecline(t), t);
});
