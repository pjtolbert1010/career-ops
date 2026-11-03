import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";

export const ANSWER_SECTIONS = ["contact", "work_authorization", "logistics", "compensation", "experience", "eeo", "referral", "sensitive"];
const ANSWER_KEYS = {
  contact: ["full_name", "preferred_name", "email", "phone", "address", "city", "state", "zip", "linkedin"],
  work_authorization: ["authorized_to_work_us", "requires_sponsorship"],
  logistics: ["earliest_start", "willing_to_relocate", "work_arrangement"],
  compensation: ["salary_floor", "currency"],
  experience: ["years_experience", "highest_degree"],
  eeo: ["gender", "race_ethnicity", "veteran_status", "disability"],
  referral: ["referred_by_employee", "how_did_you_hear"],
  sensitive: ["drivers_license_number", "drivers_license_state", "drivers_license_type"],
};
const HEADER = "# Reusable application answers. Personal data: gitignored, never commit.\n#\n# Each entry: value (what to fill), labels (form-label text that maps here).\n# sensitive: true = government ID or account number. Claude never types these\n# into a form field. It shows the value and you paste it yourself.\n";
const DEFAULT_PATH = path.resolve(process.cwd(), "..", "config", "answers.yml");

export function validateAnswers(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Answers must be a section mapping");
  for (const section of Object.keys(data)) {
    if (!ANSWER_SECTIONS.includes(section)) throw new Error(`Unknown answer section: ${section}`);
    const entries = data[section];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error(`Invalid section: ${section}`);
    for (const [key, entry] of Object.entries(entries)) {
      if (!ANSWER_KEYS[section].includes(key)) throw new Error(`Unknown answer key: ${section}.${key}`);
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`Invalid answer: ${section}.${key}`);
      if (typeof entry.value !== "string" || !Array.isArray(entry.labels) || !entry.labels.every((label) => typeof label === "string") || (entry.sensitive !== undefined && typeof entry.sensitive !== "boolean")) throw new Error(`Invalid answer: ${section}.${key}`);
    }
  }
  return data;
}

export function loadAnswers(filePath = DEFAULT_PATH) {
  const source = fs.readFileSync(filePath, "utf8");
  return validateAnswers(yaml.load(source));
}

export function saveAnswers(data, filePath = DEFAULT_PATH) {
  validateAnswers(data);
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const header = existing.startsWith(HEADER) ? HEADER : HEADER;
  const temp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, header + yaml.dump(data, { noRefs: true, lineWidth: -1 }), "utf8");
    fs.renameSync(temp, filePath);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

export function updateAnswer(section, key, value, filePath = DEFAULT_PATH) {
  const data = loadAnswers(filePath);
  if (!ANSWER_SECTIONS.includes(section) || !data[section] || !Object.hasOwn(data[section], key)) throw new Error(`Unknown answer key: ${section}.${key}`);
  if (typeof value !== "string") throw new Error("Answer value must be a string");
  data[section][key].value = value;
  saveAnswers(data, filePath);
  return data;
}

export function lookupByLabel(label, data = loadAnswers()) {
  const needle = String(label).toLocaleLowerCase();
  for (const entries of Object.values(data)) for (const entry of Object.values(entries)) {
    if (entry.labels.some((candidate) => candidate.toLocaleLowerCase() === needle)) return entry;
  }
  return null;
}
