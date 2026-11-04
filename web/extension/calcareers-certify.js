// CalCareers review page: tick the two certification boxes, nothing else.
//
// Runs only on calcareers.ca.gov ReviewApplication.aspx (see manifest.json).
// Finds each box by its label text, never by id, because the ASP.NET ids
// change. Never clicks Submit or any other button and never touches any
// other field: the final submit stays with the candidate.
(() => {
  if (!/ReviewApplication\.aspx/i.test(location.pathname)) return;

  const TAG = "[career-ops certify]";
  const TARGETS = [
    { name: "agreement", prefix: "by checking here, i certify" },
    { name: "understanding", prefix: "by checking here, i understand" },
  ];
  const MAX_WAIT_MS = 5000;
  const STEP_MS = 250;

  const norm = (s) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  // Text that labels a checkbox: <label for>, a wrapping <label>, or the
  // nearest container's text when the site puts the words beside the input.
  function labelText(box) {
    const parts = [];
    if (box.labels) for (const l of box.labels) parts.push(l.textContent);
    const wrap = box.closest("label");
    if (wrap) parts.push(wrap.textContent);
    const aria = box.getAttribute("aria-labelledby");
    if (aria) for (const id of aria.split(/\s+/)) { const n = document.getElementById(id); if (n) parts.push(n.textContent); }
    if (box.getAttribute("aria-label")) parts.push(box.getAttribute("aria-label"));
    if (!parts.join("").trim()) {
      const host = box.closest("span, td, div, li, p");
      if (host) parts.push(host.textContent);
    }
    return norm(parts.join(" "));
  }

  function findBox(prefix) {
    for (const box of document.querySelectorAll('input[type="checkbox"]')) {
      if (labelText(box).startsWith(prefix)) return box;
    }
    return null;
  }

  function tick(box) {
    if (box.checked) return false;
    box.checked = true;
    box.dispatchEvent(new Event("input", { bubbles: true }));
    box.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function run() {
    const start = Date.now();
    const attempt = () => {
      const found = TARGETS.map((t) => ({ ...t, box: findBox(t.prefix) }));
      if (found.every((f) => f.box)) {
        for (const f of found) {
          const changed = tick(f.box);
          console.info(`${TAG} ${f.name} box ${changed ? "checked" : "already checked"}. Submit left to you.`);
        }
        return;
      }
      if (Date.now() - start < MAX_WAIT_MS) return setTimeout(attempt, STEP_MS);
      const missing = found.filter((f) => !f.box).map((f) => `"${f.prefix}..."`).join(", ");
      console.warn(`${TAG} certification checkbox not found: ${missing}. Nothing was changed.`);
    };
    attempt();
  }

  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
})();
