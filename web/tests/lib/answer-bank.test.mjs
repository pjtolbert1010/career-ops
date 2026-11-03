import test from "node:test";
import assert from "node:assert/strict";
import { findEntry, normalizeQuestion, upsertAnswers } from "../../src/lib/apply/answer-bank.mjs";

test("normalizes NEOGOV numbering, required marks and the Clear link", () => {
  assert.equal(normalizeQuestion("Question 21. Do you wish to claim Veteran's Preference? Clear"), "do you wish to claim veteran s preference");
  assert.equal(normalizeQuestion("*05 What is your gender?"), "what is your gender");
});

test("one entry per question; the latest answer wins", () => {
  const bank = { entries: [] };
  assert.deepEqual(upsertAnswers(bank, [{ label: "Question 18. What is your gender? Clear", type: "radio", value: "Male" }]), { added: 1, updated: 0, skipped: 0 });
  assert.deepEqual(upsertAnswers(bank, [{ label: "What is your gender?", type: "radio", value: "Male" }]), { added: 0, updated: 0, skipped: 0 });
  upsertAnswers(bank, [{ label: "What is your gender?", type: "radio", value: "Decline" }]);
  assert.equal(bank.entries.length, 1);
  assert.equal(findEntry(bank, "*What is your gender?").answer, "Decline");
});

test("never stores ID numbers, files or blank answers", () => {
  const bank = { entries: [] };
  const r = upsertAnswers(bank, [
    { label: "Social Security Number", type: "text", value: "123" },
    { label: "Driver's License Number", type: "text", value: "D123" },
    { label: "Resume", type: "file", value: "cv.pdf" },
    { label: "Middle name", type: "text", value: "" },
  ]);
  assert.deepEqual(r, { added: 0, updated: 0, skipped: 4 });
});
