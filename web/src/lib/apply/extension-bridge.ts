// Hand an Apply click to the career-ops Chrome extension (web/extension/), when
// it is installed in the browser showing this page. The extension opens the
// posting in a new tab of that browser, so the user signs in with their own
// Google or site account, and fills the form once it shows. Resolves false
// when no extension answers, and the caller falls back to the Playwright
// apply window.

const ANSWER_MS = 600;

export function openWithExtension(job: { url: string; company: string; n: string; cliId: string | null }): Promise<boolean> {
  return new Promise((resolve) => {
    const reqId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.source !== "career-ops-ext" || d.type !== "ack" || d.reqId !== reqId) return;
      finish(true);
    };
    const timer = setTimeout(() => finish(false), ANSWER_MS);
    function finish(ok: boolean) {
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(ok);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "career-ops-web", type: "apply", reqId, ...job }, window.location.origin);
  });
}
