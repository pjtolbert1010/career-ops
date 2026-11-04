// Runs on the local career-ops dashboard (localhost / 127.0.0.1). The Apply
// button posts {source: "career-ops-web", type: "apply"} to its own window; this
// relays it to the background worker, which opens the posting in a new tab of
// this browser, and answers so the page knows the extension handled it. No
// answer within a moment means no extension, and the page falls back to its
// own Playwright apply window.
window.addEventListener("message", (e) => {
  if (e.source !== window || e.origin !== location.origin) return;
  const d = e.data;
  if (!d || d.source !== "career-ops-web" || d.type !== "apply") return;
  // Reloading the extension leaves this copy running in tabs that were already
  // open, cut off from the extension. Stay silent so the page falls back to
  // its own apply window instead of waiting on a tab that never opens.
  if (!chrome.runtime || !chrome.runtime.id) return;
  // Answer at once: waking the background worker and opening the tab can take
  // longer than the page waits before falling back to its own apply window.
  window.postMessage({ source: "career-ops-ext", type: "ack", reqId: d.reqId }, location.origin);
  chrome.runtime.sendMessage(
    { type: "open", url: d.url, company: d.company, n: d.n, cliId: d.cliId },
    (r) => {
      const err = chrome.runtime.lastError;
      window.postMessage(
        { source: "career-ops-ext", type: "opened", reqId: d.reqId, ok: !err && !!(r && r.ok), error: err ? err.message : r && r.error },
        location.origin,
      );
    },
  );
});

// The CLI picked on the dashboard's Config page, and this dashboard's address,
// for a tab the user turns career-ops on in by hand (not opened from Apply).
try {
  const raw = localStorage.getItem("career-ops:config");
  const cliId = raw ? JSON.parse(raw).cliId : "";
  if (chrome.runtime && chrome.runtime.id) chrome.runtime.sendMessage({ type: "config", cliId: typeof cliId === "string" ? cliId : "" }).catch(() => {});
} catch {
  /* no saved config */
}
