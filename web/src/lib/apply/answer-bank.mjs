/**
 * answer-bank.mjs - the user's growing bank of application answers.
 *
 * Every question the user answers on a form (through the career-ops Chrome
 * extension) is saved once, keyed by its normalized question text, so the next
 * form that asks it is filled from the bank instead of asking again. Lives at
 * {DATA_ROOT}/data/answer-bank.json: user layer, gitignored with data/*.
 *
 * Government ID numbers, account numbers and passwords are never stored
 * (isSecretQuestion), and neither are file uploads.
 *
 * Entry: { id, question, labels: string[], type, answer, options?, updated }
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const SECRET = /social security|\bssn\b|licen[cs]e (number|#|no\b)|passport|account (number|#)|routing|password|\bpin\b|tax id|\bein\b/i;
const MAX_ANSWER = 8000;

export function bankPath(root) {
  return path.join(root, "data", "answer-bank.json");
}

/** Question text reduced to what identifies it across forms and ATSs. */
export function normalizeQuestion(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/\(required\)|\*/g, "")
    .replace(/^\s*(question\s*)?\d+\s*([.:)]\s*|\s+)/, "")
    .replace(/\s+clear\s*$/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function isSecretQuestion(label) {
  return SECRET.test(String(label ?? ""));
}

export function loadBank(root) {
  try {
    const data = JSON.parse(fs.readFileSync(bankPath(root), "utf8"));
    return Array.isArray(data?.entries) ? data : { version: 1, entries: [] };
  } catch {
    return { version: 1, entries: [] };
  }
}

export function saveBank(root, bank) {
  const file = bankPath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(bank, null, 2)}\n`, "utf8");
  fs.renameSync(temp, file);
}

/** The entry answering this label, or null. */
export function findEntry(bank, label) {
  const key = normalizeQuestion(label);
  if (!key) return null;
  return bank.entries.find((e) => e.labels.some((l) => normalizeQuestion(l) === key)) ?? null;
}

/**
 * Save answered fields into the bank. One entry per question: an existing
 * question gets the new answer (the latest answer wins), a new one is added.
 * @param {{entries: object[]}} bank - mutated in place
 * @param {{label: string, type: string, value: string, options?: string[]}[]} items
 * @returns {{added: number, updated: number, skipped: number}}
 */
export function upsertAnswers(bank, items, now = new Date()) {
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    const label = String(item?.label ?? "").trim().slice(0, 300);
    const answer = String(item?.value ?? "").trim().slice(0, MAX_ANSWER);
    const type = String(item?.type ?? "text");
    if (!normalizeQuestion(label) || !answer || type === "file" || isSecretQuestion(label)) {
      skipped += 1;
      continue;
    }
    const options = Array.isArray(item.options) ? item.options.map(String).slice(0, 80) : undefined;
    const existing = findEntry(bank, label);
    if (existing) {
      if (existing.answer !== answer) updated += 1;
      existing.answer = answer;
      existing.type = type;
      if (options?.length) existing.options = options;
      existing.updated = now.toISOString();
      continue;
    }
    bank.entries.push({
      id: crypto.randomUUID(),
      question: label.replace(/^\s*(question\s*)?\d+\s*[.:)]\s*/i, "").replace(/\s+Clear\s*$/, ""),
      labels: [label],
      type,
      answer,
      ...(options?.length ? { options } : {}),
      updated: now.toISOString(),
    });
    added += 1;
  }
  return { added, updated, skipped };
}
