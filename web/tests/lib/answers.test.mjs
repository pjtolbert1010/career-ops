import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAnswers, saveAnswers, updateAnswer, lookupByLabel } from "../../src/lib/answers.mjs";

test("answers round-trip preserves header and sensitive flags", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answers-test-"));
  const file = path.join(dir, "answers.yml");
  const original = fs.readFileSync(path.resolve(process.cwd(), "../config/answers.yml"), "utf8");
  try {
    fs.writeFileSync(file, original);
    const data = loadAnswers(file);
    saveAnswers(data, file);
    const after = fs.readFileSync(file, "utf8");
    assert.equal(after.slice(0, 5), original.slice(0, 5));
    assert.match(after, /^# Reusable application answers[\s\S]*?# into a form field\. It shows the value and you paste it yourself\.\n/);
    assert.equal(loadAnswers(file).sensitive.drivers_license_number.sensitive, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("unknown answer key is rejected without writing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answers-test-"));
  const file = path.join(dir, "answers.yml");
  try {
    fs.copyFileSync(path.resolve(process.cwd(), "../config/answers.yml"), file);
    assert.throws(() => updateAnswer("contact", "not_a_key", "x", file), /Unknown answer key/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("value edits save and revert against a temporary copy", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "answers-test-"));
  const file = path.join(dir, "answers.yml");
  try {
    fs.copyFileSync(path.resolve(process.cwd(), "../config/answers.yml"), file);
    const original = loadAnswers(file).contact.email.value;
    updateAnswer("contact", "email", "temporary@example.test", file);
    assert.equal(loadAnswers(file).contact.email.value, "temporary@example.test");
    updateAnswer("contact", "email", original, file);
    assert.equal(loadAnswers(file).contact.email.value, original);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("lookupByLabel matches case-insensitively", () => {
  const data = { contact: { email: { value: "a@b.test", labels: ["Email Address"] } } };
  assert.equal(lookupByLabel("email address", data).value, "a@b.test");
});
