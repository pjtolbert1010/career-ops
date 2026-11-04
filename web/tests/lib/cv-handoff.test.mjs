import test from "node:test";
import assert from "node:assert/strict";
import { HANDOFF_MAX_USES, HANDOFF_TTL_MS, isCvHandoffFetch, mintHandoff, redeemHandoff } from "../../src/lib/cv-handoff.mjs";
import { checkRequest } from "../../src/lib/origin-guard.mjs";

test("a minted token reads back its pipeline id", () => {
  const tokens = new Map();
  const { token, expiresAt } = mintHandoff("23", { now: 1000, tokens });
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(expiresAt, 1000 + HANDOFF_TTL_MS);
  assert.equal(redeemHandoff(token, { now: 2000, tokens }), "23");
});

test("every token is different", () => {
  const tokens = new Map();
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(mintHandoff("1", { tokens }).token);
  assert.equal(seen.size, 50);
});

test("a token stops working when it expires", () => {
  const tokens = new Map();
  const { token } = mintHandoff("7", { now: 0, tokens });
  assert.equal(redeemHandoff(token, { now: HANDOFF_TTL_MS - 1, tokens }), "7");
  assert.equal(redeemHandoff(token, { now: HANDOFF_TTL_MS, tokens }), null);
  assert.equal(tokens.size, 0);
});

test("a token stops working after its last read", () => {
  const tokens = new Map();
  const { token } = mintHandoff("7", { now: 0, tokens });
  for (let i = 0; i < HANDOFF_MAX_USES; i++) assert.equal(redeemHandoff(token, { now: 1, tokens }), "7");
  assert.equal(redeemHandoff(token, { now: 1, tokens }), null);
});

test("unknown and malformed tokens read nothing", () => {
  const tokens = new Map();
  mintHandoff("7", { tokens });
  assert.equal(redeemHandoff("A".repeat(43), { tokens }), null);
  assert.equal(redeemHandoff("short", { tokens }), null);
  assert.equal(redeemHandoff(undefined, { tokens }), null);
  assert.equal(redeemHandoff("../../etc/passwd", { tokens }), null);
});

test("minting refuses an id that is not a record number", () => {
  assert.throws(() => mintHandoff("23; rm", { tokens: new Map() }));
  assert.throws(() => mintHandoff("", { tokens: new Map() }));
});

test("minting sweeps dead tokens", () => {
  const tokens = new Map();
  mintHandoff("1", { now: 0, tokens });
  mintHandoff("2", { now: HANDOFF_TTL_MS + 1, tokens });
  assert.equal(tokens.size, 1);
});

test("only a read of a handoff link is exempt from the cross-site check", () => {
  const token = "a".repeat(43);
  assert.equal(isCvHandoffFetch("GET", `/api/cv-handoff/${token}`), true);
  assert.equal(isCvHandoffFetch("OPTIONS", `/api/cv-handoff/${token}`), true);
  assert.equal(isCvHandoffFetch("HEAD", `/api/cv-handoff/${token}`), true);
  // Minting stays same-origin.
  assert.equal(isCvHandoffFetch("POST", "/api/cv-handoff"), false);
  assert.equal(isCvHandoffFetch("POST", `/api/cv-handoff/${token}`), false);
  assert.equal(isCvHandoffFetch("GET", "/api/cv-handoff"), false);
  // No other route, and no path tricks.
  assert.equal(isCvHandoffFetch("GET", `/api/cv-pdf/${token}`), false);
  assert.equal(isCvHandoffFetch("GET", `/api/cv-handoff/${token}/x`), false);
  assert.equal(isCvHandoffFetch("GET", `/api/cv-handoff/${token}a`), false);
  assert.equal(isCvHandoffFetch("GET", `/x/api/cv-handoff/${token}`), false);
});

test("the exempt read still gets the Host check", () => {
  // proxy.ts passes no Sec-Fetch-Site and no Origin for a handoff read.
  const read = (host) => checkRequest({ secFetchSite: null, origin: null, host, allowedHosts: new Set(), allowedOrigins: new Set() });
  assert.equal(read("localhost:3000").ok, true);
  assert.equal(read("127.0.0.1:3000").ok, true);
  assert.equal(read("evil.example:3000").ok, false);
  assert.equal(read("").ok, false);
});
