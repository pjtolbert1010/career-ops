// career-ops Apply: background worker.
//
// Tracks the tabs the dashboard opened (tab id -> job), injects filler.js into
// every frame of those tabs as it loads, and calls the dashboard's
// /api/apply/extension/draft route for answers. The server address is taken
// from the tab that sent the Apply message, never from the message body, so a
// page can only reach the dashboard it is served by.

const MAX_DRAFTS_PER_TAB = 12;

async function jobs() {
  const { jobs = {} } = await chrome.storage.session.get("jobs");
  return jobs;
}
async function saveJobs(all) {
  await chrome.storage.session.set({ jobs: all });
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
      };
      await saveJobs(all);
      return sendResponse({ ok: true });
    }
    if (msg.type === "job") {
      return sendResponse(sender.tab ? await jobFor(sender.tab.id) : null);
    }
    if (msg.type === "status" && sender.tab) {
      // A frame's progress, shown by the badge in the tab's top frame.
      chrome.tabs.sendMessage(sender.tab.id, { type: "status-relay", text: msg.text, kind: msg.kind }, { frameId: 0 }).catch(() => {});
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
    if (!job) return port.postMessage({ error: "this tab was not opened by career-ops" });
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

// Inject into every frame of a tracked tab as it finishes loading: the first
// page, the sign-in pages, and the form after sign-in all land here.
chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (!/^https?:/i.test(url) || !(await jobFor(tabId))) return;
  chrome.scripting.executeScript({ target: { tabId, frameIds: [frameId] }, files: ["filler.js"] }).catch(() => {});
});

// Some sites open the application in a popup or new tab: it inherits the job.
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
