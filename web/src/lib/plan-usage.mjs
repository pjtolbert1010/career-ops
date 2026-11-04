// plan-usage.mjs — real plan-limit usage for the agent CLIs on this machine,
// for the sidebar usage meter. Server-only: reads files under the user's home.
//
// - Claude: Claude Code keeps no usage figures on disk, so this asks
//   Anthropic's usage service (the one Claude Code's own usage view uses) with
//   the OAuth token Claude Code stores in ~/.claude/.credentials.json. The
//   token never leaves this server except as that request's Authorization
//   header, and only percentages and reset times come back to the page. The
//   service is undocumented: any failure returns null and the meter falls back
//   to the local token estimate. An expired token is never refreshed here;
//   Claude Code refreshes it the next time it runs.
// - Codex: Codex writes its real rate-limit percentages into its session logs
//   (~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl, `token_count` events), so
//   the newest one is read locally. No network.
// - Other CLIs (Antigravity, Gemini, …) record no limit figures locally; they
//   are listed as "no usage data" rather than guessed at.

import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const TIMEOUT_MS = 6000;

/**
 * @typedef {{ label: string, usedPercent: number, resetsAt: string | null }} UsageWindow
 * @typedef {{ id: string, name: string, plan: string | null, windows: UsageWindow[], source: "live" | "local-log" | "none", note: string | null, observedAt: string | null }} ProviderUsage
 */

const WINDOW_LABEL = {
  five_hour: "5-hour",
  seven_day: "Weekly",
  seven_day_opus: "Weekly · Opus",
  seven_day_sonnet: "Weekly · Sonnet",
  seven_day_oauth_apps: "Weekly · apps",
};

function pct(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : null;
}

/** Claude's token from Claude Code's credentials file, or null. */
function readClaudeToken(home) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(home, ".claude", ".credentials.json"), "utf8"));
  } catch {
    return null;
  }
  const o = raw?.claudeAiOauth;
  if (!o || typeof o.accessToken !== "string" || !o.accessToken) return null;
  if (typeof o.expiresAt === "number" && o.expiresAt < Date.now()) return { token: null, plan: o.subscriptionType ?? null, expired: true };
  return { token: o.accessToken, plan: typeof o.subscriptionType === "string" ? o.subscriptionType : null, expired: false };
}

// The usage service rate-limits (429) when polled every minute, so a good
// answer is reused for 5 minutes, a 429 or other failure pauses requests for
// 10, and while paused the last good answer is shown with its observedAt time.
const FRESH_MS = 5 * 60_000;
const BACKOFF_MS = 10 * 60_000;
/** @type {{ good: ProviderUsage | null, goodAt: number, pausedUntil: number, lastFail: ProviderUsage | null }} */
const claudeCache = { good: null, goodAt: 0, pausedUntil: 0, lastFail: null };

/**
 * @param {{ home?: string, fetchImpl?: typeof fetch, now?: number }} [opts]
 * @returns {Promise<ProviderUsage | null>} null when Claude Code is not signed in on this machine
 */
export async function claudePlanUsage({ home = os.homedir(), fetchImpl = fetch, now = Date.now() } = {}) {
  if (claudeCache.good && now - claudeCache.goodAt < FRESH_MS) return claudeCache.good;
  if (now < claudeCache.pausedUntil) return claudeCache.good ?? claudeCache.lastFail;
  const result = await fetchClaudePlanUsage(home, fetchImpl);
  if (result?.source === "live") {
    claudeCache.good = result;
    claudeCache.goodAt = now;
  } else if (result) {
    claudeCache.pausedUntil = now + BACKOFF_MS;
    claudeCache.lastFail = result;
    return claudeCache.good ?? result;
  }
  return result;
}

/** Test seam: forget cached Claude answers. */
export function resetClaudeUsageCache() {
  Object.assign(claudeCache, { good: null, goodAt: 0, pausedUntil: 0, lastFail: null });
}

async function fetchClaudePlanUsage(home, fetchImpl) {
  const cred = readClaudeToken(home);
  if (!cred) return null;
  const base = { id: "claude", name: "Claude", plan: cred.plan, windows: [], source: /** @type {const} */ ("none"), note: null, observedAt: null };
  if (cred.expired) return { ...base, note: "Sign-in expired. Run Claude Code once to refresh it." };
  try {
    const res = await fetchImpl(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": "career-reef-dashboard",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ...base, note: `Usage service answered ${res.status}.` };
    const body = await res.json();
    const windows = [];
    for (const [key, label] of Object.entries(WINDOW_LABEL)) {
      const w = body?.[key];
      const used = w && typeof w === "object" ? pct(w.utilization) : null;
      if (used == null) continue;
      windows.push({ label, usedPercent: used, resetsAt: typeof w.resets_at === "string" ? w.resets_at : null });
    }
    if (!windows.length) return { ...base, note: "Usage service returned no limits." };
    return { ...base, windows, source: "live", observedAt: new Date().toISOString() };
  } catch {
    return { ...base, note: "Usage service unreachable." };
  }
}

/** Newest rollout file under ~/.codex/sessions, walking YYYY/MM/DD newest-first. */
async function newestCodexSession(home) {
  const root = path.join(home, ".codex", "sessions");
  const desc = async (dir) => {
    try {
      return (await fsp.readdir(dir)).sort().reverse();
    } catch {
      return [];
    }
  };
  for (const y of await desc(root)) {
    for (const m of await desc(path.join(root, y))) {
      for (const d of await desc(path.join(root, y, m))) {
        const dir = path.join(root, y, m, d);
        const files = (await desc(dir)).filter((f) => f.endsWith(".jsonl"));
        if (files.length) return path.join(dir, files[0]);
      }
    }
  }
  return null;
}

function windowLabel(minutes) {
  if (!Number.isFinite(minutes)) return "Limit";
  if (minutes <= 5 * 60) return "5-hour";
  if (minutes <= 7 * 24 * 60) return "Weekly";
  if (minutes <= 31 * 24 * 60) return "Monthly";
  return "Limit";
}

/**
 * @param {{ home?: string }} [opts]
 * @returns {Promise<ProviderUsage | null>} null when Codex has no session logs here
 */
export async function codexPlanUsage({ home = os.homedir() } = {}) {
  const file = await newestCodexSession(home);
  if (!file) return null;
  let text;
  try {
    const fh = await fsp.open(file, "r");
    try {
      const { size } = await fh.stat();
      const len = Math.min(size, 512 * 1024);
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, size - len);
      text = buf.toString("utf8");
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
  const lines = text.split("\n").filter((l) => l.includes('"rate_limits"'));
  for (let i = lines.length - 1; i >= 0; i--) {
    let ev;
    try {
      ev = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const rl = ev?.payload?.rate_limits;
    if (!rl || typeof rl !== "object") continue;
    const now = Date.now() / 1000;
    const windows = [];
    for (const slot of [rl.primary, rl.secondary]) {
      if (!slot || typeof slot !== "object") continue;
      let used = pct(slot.used_percent);
      if (used == null) continue;
      const resets = Number(slot.resets_at);
      // The log is a snapshot: a window that has reset since is back to 0.
      if (Number.isFinite(resets) && resets < now) used = 0;
      windows.push({ label: windowLabel(Number(slot.window_minutes)), usedPercent: used, resetsAt: Number.isFinite(resets) ? new Date(resets * 1000).toISOString() : null });
    }
    if (!windows.length) continue;
    return { id: "codex", name: "Codex", plan: typeof rl.plan_type === "string" ? rl.plan_type : null, windows, source: "local-log", note: null, observedAt: typeof ev.timestamp === "string" ? ev.timestamp : null };
  }
  return { id: "codex", name: "Codex", plan: null, windows: [], source: "none", note: "No usage recorded in Codex's logs yet.", observedAt: null };
}

/** A CLI with no local limit data: listed so the user sees it is not forgotten. */
export function noDataUsage(id, name) {
  return { id, name, plan: null, windows: [], source: /** @type {const} */ ("none"), note: "Doesn't report usage limits locally.", observedAt: null };
}
