/**
 * Voluntary EEO questions the user has chosen to decline.
 *
 * When an `eeo` entry in config/answers.yml holds a decline answer ("I choose
 * not to identify"), a matching demographic question is answered with the
 * form's own decline option, whatever that form calls it ("Decline to
 * self-identify", "I don't wish to answer"). A question with no decline
 * option is left alone, never answered with a real value. A standalone
 * checkbox whose label is itself the decline ("I choose not to Identify") is
 * checked when any eeo answer is a decline.
 */

const DECLINE =
  /\b(?:(?:choose|prefer|wish|want|elect)\s+not\s+to\s+(?:self[-\s]?)?(?:identify|disclose|answer|say|specify|state|provide)|decline(?:d)?\s+to\s+(?:self[-\s]?)?(?:identify|answer|state|disclose|specify|provide)|do(?:\s+not|n['’]t)\s+wish\s+to\s+(?:self[-\s]?)?(?:identify|answer|disclose|specify|provide)|prefer\s+not\s+to\s+(?:say|answer|disclose)|not\s+(?:wish|want)\s+to\s+(?:self[-\s]?)?identify|decline\s+to\s+self[-\s]?identify)\b/i;

const TOPICS = {
  gender: /\b(gender|sex)\b/i,
  race_ethnicity: /\b(race|racial|ethnic|ethnicity|heritage|hispanic|latin[oax])\b/i,
  veteran_status: /\b(veteran|military)\b/i,
  disability: /\bdisab/i,
};

export const isDecline = (text) => DECLINE.test(String(text ?? ""));

/**
 * @param {{ type: string, label: string, options?: string[] }} field
 * @param {Record<string, Record<string, { value: string }>>} answers loaded answers.yml
 * @returns {string | null} the value to fill, or null to leave the field to the other steps
 */
export function eeoDecline(field, answers) {
  const eeo = answers && typeof answers === "object" ? answers.eeo : null;
  if (!eeo || typeof eeo !== "object") return null;
  const declined = Object.keys(TOPICS).filter((k) => eeo[k] && isDecline(eeo[k].value));
  if (!declined.length) return null;
  const label = String(field.label ?? "");
  if (field.type === "checkbox") return isDecline(label) ? "true" : null;
  if (field.type !== "radio" && field.type !== "select") return null;
  if (!declined.some((k) => TOPICS[k].test(label))) return null;
  const hit = (field.options ?? []).find(isDecline);
  return hit ?? null;
}
