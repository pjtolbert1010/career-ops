// Short-lived links that hand one tailored document PDF (the CV, the Statement
// of Qualifications or the cover letter) to a job application page.
//
// Claude in Chrome cannot upload a file from the user's disk, so it attaches
// the tailored CV from inside the application page instead: it fetches the PDF
// and puts it into the page's file input. That fetch comes from the job site's
// origin, which the dashboard's origin guard refuses for every other route.
//
// A handoff link is the one exception, and it is a capability URL:
//   - It is minted only by a same-origin POST from the dashboard itself
//     (POST /api/cv-handoff), which the origin guard still checks, so another
//     site cannot mint one.
//   - The token is 32 random bytes and names one pipeline record. Knowing it is
//     the only way to read that CV, and the page it is handed to is the one the
//     user is attaching the CV to anyway.
//   - It expires after HANDOFF_TTL_MS and after HANDOFF_MAX_USES reads.
//   - The Host check (loopback, or an opted-in host) still applies.
//
// Tokens live in memory only, so a dashboard restart revokes them all.

export const HANDOFF_TTL_MS = 10 * 60 * 1000;
export const HANDOFF_MAX_USES = 5;

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
const HANDOFF_PATH_RE = /^\/api\/cv-handoff\/[A-Za-z0-9_-]{43}$/;

/** The process-wide token store, shared by both handoff routes. */
function defaultStore() {
  const g = /** @type {any} */ (globalThis);
  if (!g.__careerReefCvHandoff) g.__careerReefCvHandoff = new Map();
  return g.__careerReefCvHandoff;
}

function sweep(tokens, now) {
  for (const [token, entry] of tokens) {
    if (now >= entry.expiresAt || entry.uses >= HANDOFF_MAX_USES) tokens.delete(token);
  }
}

function randomToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** The documents a handoff link can carry. */
export const HANDOFF_KINDS = ["cv", "soq", "cover"];

/**
 * Mint a handoff token for one pipeline record's document.
 * @param {string} id  tracker row number, digits only
 * @param {{ kind?: "cv" | "soq" | "cover" }} [opts]  which document; the CV by default
 * @returns {{ token: string, expiresAt: number }}
 */
export function mintHandoff(id, { now = Date.now(), tokens = defaultStore(), kind = "cv" } = {}) {
  if (!/^\d+$/.test(String(id))) throw new Error("pipeline id must be digits");
  if (!HANDOFF_KINDS.includes(kind)) throw new Error(`unknown document kind "${kind}"`);
  sweep(tokens, now);
  const token = randomToken();
  const expiresAt = now + HANDOFF_TTL_MS;
  tokens.set(token, { id: String(id), kind, expiresAt, uses: 0 });
  return { token, expiresAt };
}

/**
 * Spend one read of a handoff token.
 * @returns {{ id: string, kind: "cv" | "soq" | "cover" } | null} the record and document, or null for an unknown, expired or used-up token
 */
export function redeemHandoffEntry(token, { now = Date.now(), tokens = defaultStore() } = {}) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const entry = tokens.get(token);
  if (!entry) return null;
  if (now >= entry.expiresAt || entry.uses >= HANDOFF_MAX_USES) {
    tokens.delete(token);
    return null;
  }
  entry.uses += 1;
  return { id: entry.id, kind: entry.kind || "cv" };
}

/**
 * Spend one read of a handoff token.
 * @returns {string | null} the pipeline id, or null for an unknown, expired or used-up token
 */
export function redeemHandoff(token, opts = {}) {
  return redeemHandoffEntry(token, opts)?.id ?? null;
}

/**
 * True for a read of a handoff link: the only request the origin guard lets
 * through from another site. Minting (POST /api/cv-handoff) is not one.
 */
export function isCvHandoffFetch(method, pathname) {
  const m = String(method || "").toUpperCase();
  return (m === "GET" || m === "HEAD" || m === "OPTIONS") && HANDOFF_PATH_RE.test(String(pathname || ""));
}
