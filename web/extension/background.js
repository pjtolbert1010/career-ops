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
      return sendResponse({ ok: true });
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
      chrome.tabs.sendMessage(sender.tab.id, { type: "status-relay", text: msg.text, kind: msg.kind, retry: msg.retry }, { frameId: 0 }).catch(() => {});
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
        body: JSON.stringify({ title: msg.title, fields: msg.fields, cliId: job.cliId, company: job.company, application: job.n }),
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
  if (all[tabId]) all[tabId].on = false;
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
  const job = await jobFor(tab.id);
  if (job && job.on) return deactivate(tab.id);
  return activate(tab);
});

// The "Fill this application" button for a tab the dashboard opened, until
// the user turns career-ops on there. Runs in the page, so it is self-contained.
function offerFill() {
  if (window !== window.top || document.getElementById("career-ops-offer")) return;
  const host = document.createElement("div");
  host.id = "career-ops-offer";
  host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    .b{font:13px/1.4 system-ui,sans-serif;max-width:300px;padding:10px 12px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.25);color:#fff;background:#1f2937}
    .t{font-weight:600;margin-bottom:4px} button{margin-top:8px;padding:6px 12px;border-radius:6px;border:0;background:#16a34a;color:#fff;font:inherit;font-weight:600;cursor:pointer}
    .x{background:none;margin:0 0 0 8px;padding:0;font-weight:400;opacity:.8}
  </style><div class="b"><div class="t">career-ops</div>Sign in first if the site asks, then turn career-ops on to fill this application. It never submits.
    <div><button class="go">Fill this application</button><button class="x">Not now</button></div></div>`;
  root.querySelector(".go").onclick = () => {
    host.remove();
    chrome.runtime.sendMessage({ type: "activate" }).catch(() => {});
  };
  root.querySelector(".x").onclick = () => host.remove();
  (document.body || document.documentElement).appendChild(host);
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
