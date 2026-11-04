import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudePlanUsage, codexPlanUsage, resetClaudeUsageCache } from "../../src/lib/plan-usage.mjs";

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "plan-usage-"));
}

function writeCred(home, cred) {
  fs.mkdirSync(path.join(home, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(home, ".claude", ".credentials.json"), JSON.stringify({ claudeAiOauth: cred }));
}

const okBody = { five_hour: { utilization: 50.4, resets_at: "2026-11-04T10:30:00Z" }, seven_day: { utilization: 27, resets_at: "2026-11-09T03:00:00Z" } };

test("claude: not signed in returns null and makes no request", async () => {
  resetClaudeUsageCache();
  let calls = 0;
  const r = await claudePlanUsage({ home: tmpHome(), fetchImpl: async () => (calls++, new Response("{}")) });
  assert.equal(r, null);
  assert.equal(calls, 0);
});

test("claude: live windows parsed, rounded, token sent only as bearer header", async () => {
  resetClaudeUsageCache();
  const home = tmpHome();
  writeCred(home, { accessToken: "tok-123", expiresAt: Date.now() + 3_600_000, subscriptionType: "pro" });
  let seen;
  const r = await claudePlanUsage({ home, fetchImpl: async (url, init) => ((seen = { url, init }), Response.json(okBody)) });
  assert.equal(r.source, "live");
  assert.equal(r.plan, "pro");
  assert.deepEqual(r.windows.map((w) => [w.label, w.usedPercent]), [["5-hour", 50], ["Weekly", 27]]);
  assert.equal(seen.init.headers.Authorization, "Bearer tok-123");
  assert.ok(!String(seen.url).includes("tok-123"));
  assert.ok(!JSON.stringify(r).includes("tok-123"), "token never reaches the page");
});

test("claude: expired token is not used", async () => {
  resetClaudeUsageCache();
  const home = tmpHome();
  writeCred(home, { accessToken: "old", expiresAt: Date.now() - 1000 });
  let calls = 0;
  const r = await claudePlanUsage({ home, fetchImpl: async () => (calls++, Response.json(okBody)) });
  assert.equal(calls, 0);
  assert.equal(r.windows.length, 0);
  assert.match(r.note, /expired/i);
});

test("claude: a 429 keeps the last good answer and pauses requests", async () => {
  resetClaudeUsageCache();
  const home = tmpHome();
  writeCred(home, { accessToken: "t", expiresAt: Date.now() + 3_600_000 });
  const t0 = 1_000_000_000_000;
  let calls = 0;
  const good = await claudePlanUsage({ home, now: t0, fetchImpl: async () => (calls++, Response.json(okBody)) });
  assert.equal(good.source, "live");
  // Within 5 minutes: cached, no request.
  await claudePlanUsage({ home, now: t0 + 60_000, fetchImpl: async () => (calls++, Response.json(okBody)) });
  assert.equal(calls, 1);
  // After 5 minutes the service answers 429: the last good answer stays.
  const after = await claudePlanUsage({ home, now: t0 + 6 * 60_000, fetchImpl: async () => (calls++, new Response("", { status: 429 })) });
  assert.equal(calls, 2);
  assert.equal(after.source, "live");
  // Paused: no request for 10 minutes.
  await claudePlanUsage({ home, now: t0 + 8 * 60_000, fetchImpl: async () => (calls++, Response.json(okBody)) });
  assert.equal(calls, 2);
});

test("codex: newest session's rate_limits read; a window past its reset reads 0", async () => {
  const home = tmpHome();
  const dir = path.join(home, ".codex", "sessions", "2026", "11", "02");
  fs.mkdirSync(dir, { recursive: true });
  const future = Math.floor(Date.now() / 1000) + 86_400;
  const past = Math.floor(Date.now() / 1000) - 60;
  const ev = (rl) => JSON.stringify({ timestamp: "2026-11-02T12:00:00Z", type: "event_msg", payload: { type: "token_count", rate_limits: rl } });
  fs.writeFileSync(
    path.join(dir, "rollout-a.jsonl"),
    [
      ev({ plan_type: "free", primary: { used_percent: 10, window_minutes: 43200, resets_at: future } }),
      ev({ plan_type: "free", primary: { used_percent: 35, window_minutes: 43200, resets_at: future }, secondary: { used_percent: 90, window_minutes: 300, resets_at: past } }),
    ].join("\n") + "\n",
  );
  const r = await codexPlanUsage({ home });
  assert.equal(r.plan, "free");
  assert.deepEqual(r.windows.map((w) => [w.label, w.usedPercent]), [["Monthly", 35], ["5-hour", 0]]);
});

test("codex: no session logs returns null", async () => {
  assert.equal(await codexPlanUsage({ home: tmpHome() }), null);
});
