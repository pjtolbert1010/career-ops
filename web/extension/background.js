// career-ops Apply: background worker.
//
// Nothing fills until the user turns career-ops on in a tab, with the toolbar
// button (or Alt+Shift+F) or the "Fill this application" button on a tab the
// dashboard opened. A tab that is on (tab id -> job, with on: true) gets
// filler.js injected into every frame as it loads, until the user clicks the
// toolbar button again. Drafting calls the dashboard's
// /api/apply/extension/draft route. The server address is taken from the
// dashboard tab that sent the Apply message, never from the message body, so a
// page can only reach the dashboard it is served by; a tab turned on by hand
// uses the dashboard that last sent an Apply (default localhost:3000).

const MAX_DRAFTS_PER_TAB = 12;
const DEFAULT_SERVER = "http://localhost:3000";

// Tracked tabs live in storage.local so reloading the extension (after an
// update) keeps them. Tab ids restart with the browser, so the list is
// cleared on browser startup, before an old id can match a new tab.
chrome.runtime.onStartup.addListener(() => chrome.storage.local.remove("jobs"));

async function jobs() {
  const { jobs = {} } = await chrome.storage.local.get("jobs");
  return jobs;
}
async function saveJobs(all) {
  await chrome.storage.local.set({ jobs: all });
}
async function jobFor(tabId) {
  return (await jobs())[tabId] || null;
}

function isDashboard(urlString) {
  try {
    const u = new URL(urlString);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg.type === "open") {
      if (!sender.tab || !isDashboard(sender.url)) return sendResponse({ ok: false, error: "not the career-ops dashboard" });
      if (typeof msg.url !== "string" || !/^https?:\/\//i.test(msg.url)) return sendResponse({ ok: false, error: "bad posting URL" });
      const tab = await chrome.tabs.create({ url: msg.url, index: sender.tab.index + 1, openerTabId: sender.tab.id, active: true });
      const all = await jobs();
      all[tab.id] = {
        server: new URL(sender.url).origin,
        company: typeof msg.company === "string" ? msg.company : "",
        n: typeof msg.n === "string" ? msg.n : "",
        cliId: typeof msg.cliId === "string" ? msg.cliId : "",
        drafts: 0,
        on: false,
      };
      await saveJobs(all);
      await chrome.storage.local.set({ lastServer: all[tab.id].server, lastCliId: all[tab.id].cliId });
      // A site outside the manifest's job-site list (an employer page that
      // embeds its ATS, e.g. ?gh_jid=) gets no Fill panel and no sign-in
      // watcher until the user allows it: say so instead of staying silent.
      const origin = new URL(msg.url).origin;
      const allowed = await chrome.permissions.contains({ origins: [`${origin}/*`] }).catch(() => true);
      if (!allowed) {
        notify(`allow-${tab.id}`, `Allow career-ops on ${hostOf(msg.url)}`, "This site isn't on career-ops' job-site list yet. Click the career-ops toolbar button on that tab and choose Allow; then it can fill the application. It never submits.", { tabId: tab.id });
      }
      return sendResponse({ ok: true, allowed });
    }
    if (msg.type === "config") {
      // bridge.js on a dashboard page: remember it and its CLI pick.
      if (!sender.tab || !isDashboard(sender.url)) return sendResponse(null);
      const set = { lastServer: new URL(sender.url).origin };
      if (typeof msg.cliId === "string" && msg.cliId) set.lastCliId = msg.cliId;
      await chrome.storage.local.set(set);
      return sendResponse({ ok: true });
    }
    if (msg.type === "job") {
      const job = sender.tab ? await jobFor(sender.tab.id) : null;
      return sendResponse(job && job.on ? job : null);
    }
    if (msg.type === "activate" && sender.tab) {
      // The "Fill this application" button on a tab the dashboard opened.
      // Pressing it is the user's own click, like the toolbar button.
      const job = await jobFor(sender.tab.id);
      if (job && !job.on) await activate(sender.tab);
      return sendResponse({ ok: true });
    }
    if (msg.type === "status" && sender.tab) {
      // A frame's progress, shown by the badge in the tab's top frame.
      chrome.tabs.sendMessage(sender.tab.id, { type: "status-relay", text: msg.text, kind: msg.kind, retry: msg.retry, signin: msg.signin }, { frameId: 0 }).catch(() => {});
      return sendResponse({ ok: true });
    }
    if (msg.type === "needs-signin" && sender.tab) {
      // The filler hit a login / SSO / captcha / paywall and stopped. Keep the
      // tab stopped across page loads, tell Career Reef, and notify.
      const all = await jobs();
      const job = all[sender.tab.id];
      if (!job || !job.on) return sendResponse({ ok: false });
      const pageUrl = typeof msg.url === "string" && /^https?:\/\//i.test(msg.url) ? msg.url : sender.url;
      const first = !job.signinPaused;
      job.signinPaused = true;
      job.signinSite = hostOf(pageUrl);
      await saveJobs(all);
      if (first) await raiseSignin(job.server, { url: pageUrl, reason: String(msg.reason || "").slice(0, 200), kind: msg.kind, source: "apply", tabId: sender.tab.id });
      return sendResponse({ ok: true });
    }
    if (msg.type === "precheck-signin" && sender.tab) {
      // A tab the dashboard opened hit a sign-in page before the user pressed
      // Fill (offerFill's watcher). One alert per site per tab.
      const all = await jobs();
      const job = all[sender.tab.id];
      if (!job || job.on) return sendResponse({ ok: false });
      const pageUrl = typeof msg.url === "string" && /^https?:\/\//i.test(msg.url) ? msg.url : sender.url;
      const site = hostOf(pageUrl);
      if (job.precheckSite === site) return sendResponse({ ok: true });
      job.precheckSite = site;
      job.signinSite = site;
      await saveJobs(all);
      await raiseSignin(job.server, { url: pageUrl, reason: String(msg.reason || "").slice(0, 200), kind: msg.kind, source: "open", tabId: sender.tab.id });
      return sendResponse({ ok: true });
    }
    if (msg.type === "precheck-done" && sender.tab) {
      // "I'm signed in" on that panel: clear the alert for the site.
      const all = await jobs();
      const job = all[sender.tab.id];
      if (!job) return sendResponse({ ok: false });
      if (job.precheckSite) await resolveSignin(job.server, job.precheckSite);
      job.precheckSite = "";
      await saveJobs(all);
      return sendResponse({ ok: true });
    }
    if (msg.type === "signin-status" && sender.tab) {
      // Still stopped? Cleared when "I'm signed in" is pressed here or on Career Reef.
      const all = await jobs();
      const job = all[sender.tab.id];
      if (!job || !job.signinPaused) return sendResponse({ paused: false });
      const open = await openAlertFor(job.server, job.signinSite);
      if (open === false) {
        job.signinPaused = false;
        await saveJobs(all);
        return sendResponse({ paused: false });
      }
      return sendResponse({ paused: true });
    }
    if (msg.type === "signin-done" && sender.tab) {
      const all = await jobs();
      const job = all[sender.tab.id];
      if (!job) return sendResponse({ ok: false });
      if (job.signinSite) await resolveSignin(job.server, job.signinSite);
      job.signinPaused = false;
      await saveJobs(all);
      chrome.tabs.sendMessage(sender.tab.id, { type: "signin-resume" }).catch(() => {});
      return sendResponse({ ok: true });
    }
    if (msg.type === "ready-for-submit" && sender.tab) {
      const job = await jobFor(sender.tab.id);
      notify(`ready-${sender.tab.id}`, "Application ready for your review", `${job && job.company ? `${job.company}: ` : ""}filled and stopped at Submit. Review it, then press Submit yourself.`, { tabId: sender.tab.id });
      return sendResponse({ ok: true });
    }
    if (msg.type === "react-select" && sender.tab) {
      const job = await jobFor(sender.tab.id);
      if (!job || !job.on || typeof msg.id !== "string") return sendResponse(null);
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
          world: "MAIN",
          func: reactSelectInPage,
          args: [msg.id, msg.op === "select" ? "select" : "options", typeof msg.value === "string" ? msg.value.slice(0, 300) : ""],
        });
        return sendResponse(res ? res.result : null);
      } catch {
        return sendResponse(null);
      }
    }
    if (msg.type === "learn" && sender.tab) {
      const job = await jobFor(sender.tab.id);
      if (!job) return sendResponse({ error: "this tab was not opened by career-ops" });
      try {
        const r = await fetch(`${job.server}/api/apply/extension/learn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: msg.items }) });
        return sendResponse(await r.json().catch(() => ({ error: `career-ops answered ${r.status}` })));
      } catch {
        return sendResponse({ error: "couldn't reach career-ops; is the dashboard still running?" });
      }
    }
    if (msg.type === "learn-all" && sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, { type: "learn-relay" }).catch(() => {});
      return sendResponse({ ok: true });
    }
    if (msg.type === "open-bank" && sender.tab) {
      const job = await jobFor(sender.tab.id);
      if (job) await chrome.tabs.create({ url: `${job.server}/answers`, index: sender.tab.index + 1 });
      return sendResponse({ ok: true });
    }
    if (msg.type === "retry" && sender.tab) {
      // The top frame's retry button: pass it to every frame (the top one ignores its own echo while busy).
      chrome.tabs.sendMessage(sender.tab.id, { type: "retry-relay" }).catch(() => {});
      return sendResponse({ ok: true });
    }
    sendResponse(null);
  })();
  return true;
});

// Drafting can take minutes. It runs over a port: the filler pings it while it
// waits, and each message keeps this worker alive until the answer arrives.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "draft") return;
  port.onMessage.addListener(async (msg) => {
    if (msg.type !== "draft") return;
    const tabId = port.sender && port.sender.tab && port.sender.tab.id;
    const all = await jobs();
    const job = tabId != null ? all[tabId] : null;
    if (!job || !job.on) return port.postMessage({ error: "career-ops is off in this tab; click its toolbar button to turn it on" });
    if (job.drafts >= MAX_DRAFTS_PER_TAB) return port.postMessage({ error: "draft limit reached for this tab; use Apply again from career-ops" });
    job.drafts += 1;
    await saveJobs(all);
    try {
      const r = await fetch(`${job.server}/api/apply/extension/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // docs: the extra documents the form has uploads for and the user's
        // toggles allow (the Statement of Qualifications, the cover letter).
        body: JSON.stringify({ title: msg.title, fields: msg.fields, cliId: job.cliId, company: job.company, application: job.n, docs: Array.isArray(msg.docs) ? msg.docs.filter((k) => k === "soq" || k === "cover") : [] }),
      });
      const data = await r.json().catch(() => ({ error: `career-ops answered ${r.status}` }));
      port.postMessage(r.ok ? data : { error: data.error || `career-ops answered ${r.status}` });
    } catch {
      port.postMessage({ error: "couldn't reach career-ops; is the dashboard still running?" });
    }
  });
});

// ---- react-select dropdowns

// Runs in the page's own JavaScript world, where React keeps its component
// instances (the filler's isolated world can't see them). Finds the
// react-select component behind the control the filler tagged, then lists its
// options or selects the one matching the answer. Async dropdowns (a city
// search) get the answer typed as a search first. Self-contained: it is
// serialized into the page.
function reactSelectInPage(coId, op, value) {
  const el = document.querySelector(`[data-co-field="${CSS.escape(coId)}"]`);
  if (!el) return { ok: false };
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
  let fiber = key ? el[key] : null;
  let sel = null;
  for (let i = 0; fiber && i < 40; i++, fiber = fiber.return) {
    const sn = fiber.stateNode;
    if (sn && typeof sn.selectOption === "function" && sn.props) {
      sel = sn;
      break;
    }
  }
  if (!sel) return { ok: false };
  const flat = () => (sel.props.options || []).flatMap((o) => (o && o.options ? o.options : [o])).filter(Boolean);
  const label = (o) => String(typeof sel.props.getOptionLabel === "function" ? sel.props.getOptionLabel(o) : o.label ?? o.value ?? "").trim();
  if (op === "options") return { ok: true, found: true, options: flat().map(label).slice(0, 80) };
  const DECLINE = /decline|not (wish|want) to (answer|identify|disclose|say|self)|prefer not|choose not|rather not/i;
  const pick = (labels) => {
    const v = value.trim().toLowerCase();
    const opts = labels.map((o) => o.toLowerCase());
    let i = opts.indexOf(v);
    if (i < 0) i = opts.findIndex((o) => o.startsWith(v) || v.startsWith(o));
    if (i < 0) i = opts.findIndex((o) => o.includes(v) || (o.length > 2 && v.includes(o)));
    if (i < 0 && DECLINE.test(v)) i = opts.findIndex((o) => DECLINE.test(o));
    return i;
  };
  return (async () => {
    let opts = flat();
    let i = pick(opts.map(label));
    if (!opts.length && value && typeof sel.handleInputChange === "function") {
      // Search-as-you-type (no options until something is typed): they load
      // after the text changes.
      sel.handleInputChange({ currentTarget: { value }, target: { value } });
      for (let t = 0; t < 25; t++) {
        await new Promise((r) => setTimeout(r, 300));
        opts = flat();
        if (opts.length && !sel.props.isLoading) break;
      }
      // A search result is already filtered by the answer: the first one is it.
      i = opts.length ? Math.max(0, pick(opts.map(label))) : -1;
    }
    if (i < 0) return { ok: false, found: true };
    sel.selectOption(opts[i]);
    return { ok: true, found: true, chosen: label(opts[i]) };
  })();
}

// ---- "Needs sign-in" alerts + desktop notifications

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// notification id -> what clicking it opens (a tab to focus, or a URL).
const notifyTargets = new Map();

function notify(id, title, message, target = {}) {
  notifyTargets.set(id, target);
  chrome.notifications
    .create(id, { type: "basic", iconUrl: "icon128.png", title, message, priority: 2, requireInteraction: true, ...(target.loginUrl ? { buttons: [{ title: "Open sign-in page" }] } : {}) })
    .catch(() => {});
}

chrome.notifications.onClicked.addListener(async (id) => {
  const t = notifyTargets.get(id) || {};
  if (t.tabId != null) {
    const tab = await chrome.tabs.get(t.tabId).catch(() => null);
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true }).catch(() => {});
      await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
    }
  } else if (t.loginUrl) {
    await chrome.tabs.create({ url: t.loginUrl }).catch(() => {});
  }
  chrome.notifications.clear(id).catch(() => {});
});
chrome.notifications.onButtonClicked.addListener(async (id) => {
  const t = notifyTargets.get(id) || {};
  if (t.loginUrl) await chrome.tabs.create({ url: t.loginUrl }).catch(() => {});
  chrome.notifications.clear(id).catch(() => {});
});

/** Tell Career Reef (banner + sound) and Windows (notification) that a site needs the user. */
async function raiseSignin(server, { url, loginUrl, reason, kind, source, tabId }) {
  const site = hostOf(url);
  try {
    await fetch(`${server}/api/signin-alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, loginUrl: loginUrl || url, reason, kind, source }),
    });
  } catch {
    /* dashboard down: the notification below still tells the user */
  }
  notify(`signin-${site}`, `Sign-in needed: ${site}`, `${reason || "This page needs you to sign in."} career-ops stopped there. Sign in yourself, then press "I'm signed in".`, {
    tabId,
    loginUrl: loginUrl || url,
  });
}

/** true / false when Career Reef answers; null when it can't be reached. */
async function openAlertFor(server, site) {
  try {
    const r = await fetch(`${server}/api/signin-alerts`);
    if (!r.ok) return null;
    const { alerts = [] } = await r.json();
    return alerts.some((a) => a.site === site);
  } catch {
    return null;
  }
}

async function resolveSignin(server, site) {
  try {
    await fetch(`${server}/api/signin-alerts`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site }) });
  } catch {
    /* dashboard down */
  }
  chrome.notifications.clear(`signin-${site}`).catch(() => {});
}

// ---- session sources: boards that show listings only to a signed-in member.
// The toolbar button on one of these captures the listings the page already
// shows (in the user's own signed-in Chrome) instead of filling a form. If the
// page is a login, quiz or paywall, it raises "Needs sign-in" and stops.
const SESSION_SOURCES = {
  "remotejobsfinder.co": { id: "remotejobsfinder", name: "Remote Jobs Finder", loginUrl: "https://remotejobsfinder.co/" },
};

function sessionSourceFor(url) {
  const host = hostOf(url);
  return Object.entries(SESSION_SOURCES).find(([h]) => host === h || host.endsWith(`.${h}`))?.[1] || null;
}

// Runs in the page: reads job links off the rendered listing. Self-contained.
function captureListingsInPage() {
  const text = (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 8000);
  const pw = Array.from(document.querySelectorAll("input[type=password]")).some((p) => p.offsetParent !== null);
  const loginish = pw || /\/(login|log-?in|sign-?in|signup|sign-?up|auth|onboarding|quiz)(\/|$)/i.test(location.pathname);
  const paywall = /unlock all premium|hidden jobs|upgrade to (see|view|unlock)|subscribe to (see|view|unlock)|members?[- ]only/i.test(text);
  const out = [];
  const seen = new Set();
  for (const a of document.querySelectorAll("a[href]")) {
    const href = a.href;
    if (!/^https?:/i.test(href) || seen.has(href)) continue;
    if (!/job|position|career|opening|vacanc/i.test(href)) continue;
    const card = a.closest("article, li, [class*='card' i], [class*='job' i]") || a;
    const lines = (card.innerText || a.innerText || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const title = ((a.innerText || "").trim().split("\n")[0] || lines[0] || "").slice(0, 160);
    if (title.length < 4) continue;
    const company = lines.find((l) => l !== title && l.length < 80 && !/remote|ago|\$|apply/i.test(l)) || "";
    const location = lines.find((l) => /remote|anywhere|united states|usa|worldwide|europe|americas/i.test(l)) || "";
    seen.add(href);
    out.push({ title, company, url: href, location });
    if (out.length >= 200) break;
  }
  const blocked = loginish || (paywall && out.length === 0);
  return {
    jobs: blocked ? [] : out,
    signin: blocked ? { kind: loginish ? "login" : "paywall", reason: loginish ? "The site is asking you to sign in." : "The site shows listings only to signed-in members." } : null,
  };
}

function toastInPage(text, ok) {
  const id = "career-ops-capture";
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.textContent = text;
  el.style.cssText = `position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:340px;padding:10px 12px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;color:#fff;background:${ok ? "#166534" : "#92400e"};box-shadow:0 4px 16px rgba(0,0,0,.25)`;
  (document.body || document.documentElement).appendChild(el);
  setTimeout(() => el.remove(), 12000);
}

async function captureSession(tab, source) {
  const { lastServer = DEFAULT_SERVER } = await chrome.storage.local.get("lastServer");
  let result = null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureListingsInPage });
    result = res ? res.result : null;
  } catch {
    result = null;
  }
  const say = (text, ok) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: toastInPage, args: [text, ok] }).catch(() => {});
  if (!result) return say("career-ops couldn't read this page.", false);
  if (result.signin) {
    await raiseSignin(lastServer, { url: tab.url, loginUrl: source.loginUrl, reason: `${source.name}: ${result.signin.reason}`, kind: result.signin.kind, source: source.id, tabId: tab.id });
    return say(`Stopped: ${result.signin.reason} Sign in yourself, open the job list, then click career-ops again.`, false);
  }
  try {
    const r = await fetch(`${lastServer}/api/session-capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: source.id, pageUrl: tab.url, jobs: result.jobs }),
    });
    const c = await r.json().catch(() => ({}));
    if (!r.ok) return say(`career-ops: ${c.error || `capture failed (${r.status})`}`, false);
    say(`career-ops read ${c.received} listings: ${c.added} new added to your Reef inbox (${c.title} off-target titles, ${c.scope} not open to US residents, ${c.dupes} already seen).`, true);
  } catch {
    say("career-ops: couldn't reach Career Reef. Is the dashboard running?", false);
  }
}

// ---- on / off

async function showOn(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? "ON" : "" }).catch(() => {});
  if (on) await chrome.action.setBadgeBackgroundColor({ tabId, color: "#166534" }).catch(() => {});
}

/** Turn career-ops on in a tab: find its pipeline job, then fill every frame. */
async function activate(tab) {
  const all = await jobs();
  let job = all[tab.id];
  if (!job) {
    const { lastServer = DEFAULT_SERVER, lastCliId = "" } = await chrome.storage.local.get(["lastServer", "lastCliId"]);
    job = { server: lastServer, company: "", n: "", cliId: lastCliId, drafts: 0 };
    // Which pipeline job is this page? It picks the tailored CV to attach.
    try {
      const r = await fetch(`${job.server}/api/apply/extension/match?url=${encodeURIComponent(tab.url || "")}`);
      const m = r.ok ? await r.json() : {};
      if (m && typeof m.n === "string") Object.assign(job, { n: m.n, company: m.company || "", title: m.title || "" });
    } catch {
      job.unreachable = true;
    }
  }
  job.on = true;
  all[tab.id] = job;
  await saveJobs(all);
  await showOn(tab.id, true);
  await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ["filler.js"] }).catch(() => {});
}

async function deactivate(tabId) {
  const all = await jobs();
  if (all[tabId]) Object.assign(all[tabId], { on: false, signinPaused: false });
  await saveJobs(all);
  await showOn(tabId, false);
  chrome.tabs.sendMessage(tabId, { type: "stop" }).catch(() => {});
}

// The toolbar button (and its Alt+Shift+F shortcut) turns career-ops on in
// this tab, or off when it is already on.
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null || !/^https?:/i.test(tab.url || "") || isDashboard(tab.url)) return;
  // Ask first, while the click still counts as the user's: a job site in the
  // manifest is already allowed and asks nothing; any other site asks once.
  let allowed = false;
  try {
    allowed = await chrome.permissions.request({ origins: [`${new URL(tab.url).origin}/*`] });
  } catch {
    allowed = false;
  }
  if (!allowed) return;
  const session = sessionSourceFor(tab.url);
  if (session) return captureSession(tab, session);
  const job = await jobFor(tab.id);
  if (job && job.on) return deactivate(tab.id);
  return activate(tab);
});

// The "Fill this application" button for a tab the dashboard opened, until
// the user turns career-ops on there. Runs in the page, so it is self-contained.
// The panel on a tab the dashboard opened, until the user turns career-ops on
// there: a "Fill this application" button, plus a check-only watcher. The
// watcher reads the page every few seconds (sign-in pages often appear without
// a page load, e.g. Workday's Apply -> Sign In) and, on a sign-in, single
// sign-on, captcha or paywall page, tells the background, which raises the
// Career Reef banner, the Windows notification and the chime. It never types,
// clicks or reads a password. Runs in the page, so it is self-contained.
function offerFill() {
  if (window !== window.top || window.__careerOpsOffer) return;
  window.__careerOpsOffer = true;
  const LOGIN_PATH = /\/(login|log-?in|sign-?in|signin|register|sign-?up|auth|account|mfa|2fa|sso|oauth2?)(\/|$|\?|#)/i;
  const SSO_URL = /accounts\.google\.com|login\.microsoftonline\.com|\.okta\.com|\.auth0\.com|\/sso\/|\/saml/i;
  const shown = (el, minH = 1) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height >= minH && cs.visibility !== "hidden" && cs.display !== "none";
  };
  function blocked() {
    const u = location;
    if (SSO_URL.test(u.href)) return { kind: "sso", reason: "a single sign-on page" };
    if (LOGIN_PATH.test(`${u.pathname}${u.search}${u.hash}`) || /^(login|auth|sso|accounts?)\./i.test(u.hostname)) return { kind: "login", reason: "a sign-in page" };
    if (Array.from(document.querySelectorAll("input[type=password]")).some((p) => shown(p))) return { kind: "login", reason: "a sign-in form" };
    if (/^(just a moment|attention required|verify you are human|security check)/i.test(document.title.trim())) return { kind: "captcha", reason: "a captcha / human check" };
    const frames = document.querySelectorAll('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"], iframe[title*="captcha" i]');
    for (const f of frames) if (!/size=invisible/i.test(f.src) && shown(f, 60)) return { kind: "captcha", reason: "a captcha / human check" };
    if (Array.from(document.querySelectorAll(".cf-turnstile, #challenge-form")).some((e) => shown(e, 20))) return { kind: "captcha", reason: "a captcha / human check" };
    const inputs = document.querySelectorAll("input:not([type=hidden]), textarea, select").length;
    const text = (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 6000);
    if (inputs < 3 && /\b(members?[- ]only|unlock (all )?premium|upgrade to (see|view|apply|unlock)|subscribe to (see|view|apply|unlock)|this job is for (premium|paid) members|hidden jobs)\b/i.test(text)) return { kind: "paywall", reason: "a paywall or members-only page" };
    return null;
  }
  const host = document.createElement("div");
  host.id = "career-ops-offer";
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    .b{font:13px/1.4 system-ui,sans-serif;max-width:320px;padding:10px 12px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.25);color:#fff;background:#1f2937}
    .b.warn{background:#92400e}
    .t{font-weight:600;margin-bottom:4px} button{margin-top:8px;padding:6px 12px;border-radius:6px;border:0;background:#16a34a;color:#fff;font:inherit;font-weight:600;cursor:pointer}
    .s{background:#2563eb;margin-right:6px} .x{background:none;margin:0 0 0 8px;padding:0;font-weight:400;opacity:.8} [hidden]{display:none}
  </style><div class="b"><div class="t">career-ops</div><div class="m">Sign in first if the site asks, then turn career-ops on to fill this application. It never submits.</div>
    <div><button class="s" hidden>I'm signed in</button><button class="go">Fill this application</button><button class="x">Not now</button></div></div>`;
  const box = root.querySelector(".b");
  const msg = root.querySelector(".m");
  const signedIn = root.querySelector(".s");
  root.querySelector(".go").onclick = () => {
    host.remove();
    chrome.runtime.sendMessage({ type: "activate" }).catch(() => {});
  };
  root.querySelector(".x").onclick = () => host.remove();
  signedIn.onclick = () => {
    chrome.runtime.sendMessage({ type: "precheck-done" }).catch(() => {});
    box.classList.remove("warn");
    signedIn.hidden = true;
    msg.textContent = "Thanks. Press Fill this application when the form is showing. career-ops never submits.";
  };
  (document.body || document.documentElement).appendChild(host);
  let reported = "";
  let timer = 0;
  const check = () => {
    if (!chrome.runtime || !chrome.runtime.id) return clearInterval(timer);
    const b = blocked();
    if (!b) return;
    const key = `${location.hostname}|${b.kind}`;
    if (key === reported) return;
    reported = key;
    chrome.runtime.sendMessage({ type: "precheck-signin", kind: b.kind, reason: `This application needs you: ${b.reason}.`, url: location.href }).catch(() => {});
    if (!host.isConnected) (document.body || document.documentElement).appendChild(host);
    box.classList.add("warn");
    signedIn.hidden = false;
    msg.textContent = `Sign-in needed: ${b.reason} on ${location.hostname}. Sign in yourself (career-ops never types or stores passwords), then press I'm signed in here or on Career Reef.`;
  };
  timer = setInterval(check, 2500);
  check();
}

// Each page a tab loads: fill it when career-ops is on there; on a tab the
// dashboard opened and the user has not turned on yet, offer the button.
chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (!/^https?:/i.test(url)) return;
  const job = await jobFor(tabId);
  if (!job) return;
  if (frameId === 0) await showOn(tabId, !!job.on);
  if (job.on) chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ["filler.js"] }).catch(() => {});
  else if (frameId === 0) chrome.scripting.executeScript({ target: { tabId }, func: offerFill }).catch(() => {});
});

// Some sites open the application in a popup or new tab: it inherits the job,
// and stays on if its opener was on.
chrome.tabs.onCreated.addListener(async (tab) => {
  if (tab.openerTabId == null) return;
  const all = await jobs();
  if (!all[tab.openerTabId] || all[tab.id]) return;
  all[tab.id] = { ...all[tab.openerTabId], drafts: 0 };
  await saveJobs(all);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const all = await jobs();
  if (!all[tabId]) return;
  delete all[tabId];
  await saveJobs(all);
});
