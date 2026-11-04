// career-ops Apply: injected into every frame of a tab where the user turned
// career-ops on (toolbar button), until they turn it off again.
//
// Presses the posting's own Apply button when the page shows no form yet,
// waits out sign-in pages, then reads the application form, asks career-ops
// for drafted answers, and fills the empty fields. It never clicks Submit or
// Next, never presses Apply on a page that has a form, and never overwrites a
// value already on the page. Answers
// the planner marks needs_confirmation (legal, visa, salary, demographic) are
// left blank and outlined for the user.
(() => {
  // Turned off and on again in the same page: this frame already has a filler.
  if (window.__careerOpsFiller) {
    window.__careerOpsFiller.start();
    return;
  }

  const TOP = window === window.top;
  let stopped = false;
  let busy = false;
  let batch = 0;
  let filledAny = false;
  let timer = null;

  // ---- which documents to attach. One switch each for the tailored CV, the
  // Statement of Qualifications (CalCareers) and the cover letter, saved in
  // the extension's storage so every frame and every job uses the same choice.
  let toggles = { cv: true, soq: true, cover: true };
  try {
    chrome.storage.local
      .get("docToggles")
      .then((v) => {
        if (v && v.docToggles) toggles = { ...toggles, ...v.docToggles };
        const host = document.getElementById("career-ops-badge");
        host?.shadowRoot?.querySelectorAll(".d input").forEach((box) => (box.checked = toggles[box.dataset.k] !== false));
      })
      .catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.docToggles && changes.docToggles.newValue) toggles = { ...toggles, ...changes.docToggles.newValue };
    });
  } catch {
    /* storage unavailable: keep the defaults */
  }

  // ---- status badge (top frame only; other frames relay through background)
  let badgeText = null;
  function badge(text, kind = "info", retry = false) {
    if (!TOP) {
      chrome.runtime.sendMessage({ type: "status", text, kind, retry }).catch(() => {});
      return;
    }
    let host = document.getElementById("career-ops-badge");
    if (!host) {
      host = document.createElement("div");
      host.id = "career-ops-badge";
      host.style.cssText = "position:fixed;right:16px;bottom:16px;z-index:2147483647;";
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = `<style>
        .b{font:13px/1.4 system-ui,sans-serif;max-width:320px;padding:10px 32px 10px 12px;border-radius:10px;
           box-shadow:0 4px 16px rgba(0,0,0,.25);color:#fff;background:#1f2937;position:relative}
        .b.ok{background:#166534}.b.warn{background:#92400e}.b.err{background:#991b1b}
        .t{font-weight:600;margin-bottom:2px}
        .x{position:absolute;top:6px;right:8px;background:none;border:0;color:#fff;font-size:15px;cursor:pointer}
        .d{margin-top:8px;font-size:12px;opacity:.95}.d label{margin-right:6px;cursor:pointer;white-space:nowrap}.d input{vertical-align:-2px;margin:0 3px 0 0}
        .r{margin-top:8px;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,.6);background:transparent;color:#fff;font:inherit;cursor:pointer}
      </style><div class="b"><div class="t">career-ops</div><div class="m"></div><button class="r" hidden>Try blank fields again</button>
        <button class="r s" hidden>Save my answers</button> <button class="r o">Open answer bank</button>
        <div class="d">Attach: <label><input type="checkbox" data-k="cv"> CV</label> <label><input type="checkbox" data-k="soq"> SOQ</label> <label><input type="checkbox" data-k="cover"> Cover letter</label></div>
        <button class="x" title="Hide">×</button></div>`;
      root.querySelector(".x").onclick = () => host.remove();
      root.querySelector(".r").onclick = () => retryBlank();
      root.querySelector(".s").onclick = () => {
        chrome.runtime.sendMessage({ type: "learn-all" }).catch(() => {});
        learn(false);
      };
      root.querySelector(".o").onclick = () => chrome.runtime.sendMessage({ type: "open-bank" }).catch(() => {});
      root.querySelectorAll(".d input").forEach((box) => {
        box.checked = toggles[box.dataset.k] !== false;
        box.onchange = () => {
          toggles = { ...toggles, [box.dataset.k]: box.checked };
          chrome.storage.local.set({ docToggles: toggles }).catch(() => {});
        };
      });
      (document.body || document.documentElement).appendChild(host);
    }
    const box = host.shadowRoot.querySelector(".b");
    box.className = `b ${kind}`;
    host.shadowRoot.querySelector(".m").textContent = text;
    host.shadowRoot.querySelector(".r").hidden = !retry;
    if (filledAny || kind !== "info") host.shadowRoot.querySelector(".s").hidden = false;
    badgeText = text;
  }
  if (TOP) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "status-relay") {
        if (msg.kind === "ok" || msg.kind === "err" || msg.kind === "warn") filledAny = true;
        badge(msg.text, msg.kind, msg.retry);
      }
      if (msg.type === "retry-relay") retryBlank(true);
    });
  } else {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "retry-relay") retryBlank(true);
      if (msg.type === "learn-relay") learn(false);
    });
  }

  // ---- answer bank: every field this frame read, by id, so what the user
  // ends up answering can be saved to career-ops and reused on the next form.
  const known = new Map();
  function currentValue(f) {
    if (f.type === "radio") {
      const on = f.group.find((r) => r.checked);
      return on ? on.getAttribute("data-co-option") || on.value || "" : "";
    }
    if (f.type === "checkbox") return f.el.checked ? "true" : "false";
    if (f.type === "select" && f.combobox) {
      const shown = f.el.closest('[class*="select__"], .select-shell')?.querySelector('[class*="single-value" i]');
      return (shown?.textContent || f.el.value || "").trim();
    }
    if (f.type === "select") return f.el.selectedIndex > 0 ? (f.el.options[f.el.selectedIndex].textContent || "").trim() : "";
    return (f.el.value || "").trim();
  }
  function collect() {
    const items = [];
    for (const f of known.values()) {
      const el = f.group ? f.group[0] : f.el;
      if (f.type === "file" || !el || !document.contains(el)) continue;
      // A bare "Speak" / "Read" checkbox means nothing without its question.
      if (f.type === "checkbox" && f.label.length < 12) continue;
      const value = currentValue(f);
      if (value && f.label) items.push({ label: f.label, type: f.type, value, options: f.options });
    }
    return items;
  }
  function learn(silent) {
    const items = collect();
    if (!items.length) {
      if (!silent && TOP) badge("No answered fields to save on this page yet.", "info", false);
      return;
    }
    chrome.runtime.sendMessage({ type: "learn", items }, (r) => {
      if (silent || chrome.runtime.lastError || !r) return;
      if (r.error) return badge(`Couldn't save answers: ${r.error}`, "err");
      badge(`Saved to career-ops: ${r.added} new, ${r.updated} updated (${r.total} questions in your bank). Next forms reuse them.`, "ok");
    });
  }
  // Moving on (Next, Save & Continue, Submit) means the page's answers are
  // final: save them quietly. This only listens; it never clicks anything.
  document.addEventListener(
    "click",
    (e) => {
      if (!known.size) return;
      const b = e.target && e.target.closest && e.target.closest("button, input[type=submit], input[type=button], a[role=button], [role=button]");
      const text = b ? (b.innerText || b.value || b.getAttribute("aria-label") || "").trim() : "";
      if (/^(next|continue|save|save (and|&) continue|submit|submit application|review|apply)\b/i.test(text)) learn(true);
    },
    true,
  );
  // Save as the user answers, too: a field they change is saved a moment
  // later, and leaving the page saves whatever is left, so nothing has to be
  // saved by hand.
  let saveTimer = 0;
  const onAnswer = (e) => {
    if (!known.size || !e.target || !e.target.closest || !e.target.closest("[data-co-field]")) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => learn(true), 1500);
  };
  document.addEventListener("change", onAnswer, true);
  document.addEventListener("focusout", onAnswer, true);
  window.addEventListener("pagehide", () => known.size && learn(true));

  // Forget every field this frame read that is still blank, so the next scan
  // drafts them again. Filled fields stay tagged and are never touched. The
  // top frame also asks the other frames to do the same.
  function retryBlank(fromRelay = false) {
    if (TOP && !fromRelay) chrome.runtime.sendMessage({ type: "retry" }).catch(() => {});
    if (busy) return;
    for (const el of document.querySelectorAll("[data-co-field]")) {
      const blank = el.type === "radio" ? !document.querySelector(`[data-co-field="${CSS.escape(el.getAttribute("data-co-field"))}"]:checked`) : el.type === "checkbox" ? !el.checked : el.type === "file" ? !(el.files && el.files.length) : el.tagName === "SELECT" ? el.selectedIndex <= 0 : !el.value;
      if (!blank) continue;
      el.removeAttribute("data-co-field");
      el.removeAttribute("data-co-option");
      el.style.outline = "";
      el.removeAttribute("title");
    }
    schedule();
  }

  // ---- sign-in detection (same rule as web/src/lib/apply/login-url.mjs)
  const LOGIN_PATH = /\/(login|log-?in|sign-?in|signin|register|sign-?up|auth|account|mfa|2fa|sso|oauth2?)(\/|$|\?|#)/i;
  function onLoginPage() {
    const u = location;
    if (LOGIN_PATH.test(`${u.pathname}${u.search}${u.hash}`) || /^(login|auth|sso|accounts?)\./i.test(u.hostname)) return true;
    return Array.from(document.querySelectorAll("input[type=password]")).some((p) => p.offsetParent !== null);
  }

  // ---- form extraction (ported from web/src/lib/apply/extract.ts)
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim().slice(0, 160);
  const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
  const isGenericPh = (s) => /^(start typing|select\b|choose|search\b|type\b|--|please select|e\.?g\.?)/i.test(s.trim());
  const ok = (s) => {
    const t = (s || "").trim();
    return t && !isUuid(t) && !isGenericPh(t) ? t : "";
  };
  const pure = (node) => {
    if (!node) return "";
    const c = node.cloneNode(true);
    c.querySelectorAll?.("input, select, textarea, option, button, [role=option], [class*='menu' i]").forEach((n) => n.remove());
    return clean(c.textContent);
  };
  const fieldGroup = (el) =>
    el.closest('[class*="field-entry" i], [class*="fieldEntry" i], [class*="form-group" i], [class*="question" i], [class*="field__" i], [class*="__field" i], fieldset, [class*="field" i]');

  function labelFor(el) {
    const aria = el.getAttribute("aria-label");
    if (ok(aria)) return aria;
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
      if (ok(t)) return t;
    }
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && ok(pure(l))) return pure(l);
    }
    const pl = el.closest("label");
    if (pl && ok(pure(pl))) return pure(pl);
    const grp = fieldGroup(el);
    if (grp) {
      const lab = grp.querySelector('label, legend, [class*="question-title" i], [class*="heading" i], [class*="label" i], [class*="title" i]');
      if (lab && ok(pure(lab))) return pure(lab);
    }
    let c = el.parentElement;
    for (let i = 0; i < 4 && c; i++, c = c.parentElement) {
      const lab = c.querySelector('label, legend, [class*="label" i], [class*="title" i], h3, h4, h5');
      if (lab && ok(pure(lab))) return pure(lab);
    }
    if (ok(el.placeholder)) return el.placeholder;
    return ok(el.name);
  }

  function groupLabel(first, options) {
    const rg = first.closest("[role=radiogroup], fieldset");
    if (rg) {
      const al = rg.getAttribute("aria-label");
      if (al) return al;
      const legend = rg.querySelector("legend");
      if (legend?.textContent?.trim()) return legend.textContent;
    }
    const optSet = new Set(options.map((o) => o.toLowerCase()));
    const container = fieldGroup(first) || first.parentElement?.parentElement || first.parentElement;
    if (container) {
      for (const c of container.querySelectorAll('label, legend, h3, h4, h5, [class*="question" i], [class*="label" i], [class*="title" i]')) {
        const t = pure(c);
        if (t && t.length > 2 && !optSet.has(t.toLowerCase()) && !isUuid(t) && !isGenericPh(t)) return t;
      }
    }
    return "";
  }

  // Shown on the page. Styled radios and checkboxes hide the input itself and
  // show its label, so for those the label (or wrapper) decides. Hidden copies
  // of a question (NEOGOV keeps some) fail both and are skipped.
  function visible(el) {
    if (el.offsetParent !== null) return true;
    if (el.type !== "radio" && el.type !== "checkbox") return false;
    const label = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.parentElement;
    return !!label && label.offsetParent !== null;
  }

  // Fields not seen by an earlier batch. Each batch tags its controls with
  // data-co-field so a multi-step form's next page is a new batch.
  function extract() {
    const fields = [];
    const seenRadio = new Set();
    const prefix = `b${batch}_`;
    let n = 0;
    for (const el of document.querySelectorAll("input, textarea, select")) {
      if (el.hasAttribute("data-co-field")) continue;
      const tag = el.tagName.toLowerCase();
      const itype = (el.type || "").toLowerCase();
      if (tag === "input" && ["hidden", "submit", "button", "image", "reset", "search", "password"].includes(itype)) continue;
      if (!visible(el)) continue;
      if (el.disabled || el.readOnly) continue;
      if (el.closest('[class*="autofill" i], #career-ops-badge')) continue;
      const isCombobox = el.getAttribute("role") === "combobox";
      if (el.closest('[class*="select__"], .select-shell') && tag === "input" && !isCombobox) continue;
      const required = el.required || el.getAttribute("aria-required") === "true";
      const id = `${prefix}${n++}`;

      if (isCombobox) {
        el.setAttribute("data-co-field", id);
        fields.push({ id, type: "select", combobox: true, label: clean(labelFor(el)), required, options: [], el });
        continue;
      }
      if (itype === "radio") {
        const name = el.name;
        if (name && seenRadio.has(name)) {
          n--;
          continue;
        }
        if (name) seenRadio.add(name);
        const group = name ? Array.from(document.querySelectorAll(`input[type=radio][name="${CSS.escape(name)}"]`)) : [el];
        const options = group.map((r) => clean(labelFor(r) || r.value));
        group.forEach((r, i) => {
          r.setAttribute("data-co-field", id);
          r.setAttribute("data-co-option", options[i] || String(i));
        });
        fields.push({ id, type: "radio", label: clean(groupLabel(el, options)) || name, required, options: options.filter(Boolean), group, empty: !group.some((r) => r.checked) });
        continue;
      }
      el.setAttribute("data-co-field", id);
      if (tag === "select") {
        const options = Array.from(el.options).map((o) => clean(o.textContent)).filter((o) => o && !/^(select|choose|--)/i.test(o));
        fields.push({ id, type: "select", label: clean(labelFor(el)), required, options, el, empty: el.selectedIndex <= 0 });
        continue;
      }
      const type = tag === "textarea" ? "textarea" : ["email", "tel", "url", "number", "date", "checkbox", "file"].includes(itype) ? itype : "text";
      const empty = type === "checkbox" ? !el.checked : type === "file" ? !(el.files && el.files.length) : !el.value;
      let label = clean(labelFor(el));
      if (type === "file" && (!label || /^(attach|upload|browse|choose( a)? file|select( a)? file|add( a)? file)$/i.test(label))) {
        const key = `${el.id || ""} ${el.name || ""}`.replace(/[_-]+/g, " ").trim();
        if (key) label = clean(`${label ? label + ": " : ""}${key}`);
      }
      fields.push({ id, type, label, required, maxLength: el.maxLength > 0 ? el.maxLength : undefined, el, empty });
    }
    return fields;
  }

  // An application form, not a search box or a newsletter signup.
  function looksLikeApplication(fields) {
    if (fields.length < 2) return false;
    const strong = fields.some((f) => /first name|last name|full name|e-?mail|phone|resume|résumé|\bcv\b|linkedin|address/i.test(f.label));
    return strong || fields.length >= 4;
  }

  // ---- filling
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RESUME = /resume|résumé|\bcv\b|curr[ií]cul(?:um|o)|lebenslauf/iu;
  const SOQ = /statement\s+of\s+qualifications?|\bsoq\b/i;
  const COVER = /cover\s*letter|letter\s+of\s+(?:interest|intent)|\bcover\b/i;
  const DOC_NAMES = { cv: "tailored CV", soq: "Statement of Qualifications", cover: "cover letter" };
  function kindOf(text) {
    if (SOQ.test(text)) return "soq";
    if (COVER.test(text)) return "cover";
    if (RESUME.test(text)) return "cv";
    return null;
  }
  // Which document a file upload wants: its own label first, then a document
  // type picked in the same dialog (CalCareers asks for the type in a select
  // next to a plain "Choose File").
  function docKind(f) {
    const own = kindOf(`${f.label} ${f.el.id || ""} ${f.el.name || ""} ${f.el.getAttribute("aria-label") || ""}`);
    if (own) return own;
    const box = f.el.closest("form, [role=dialog], .modal, fieldset");
    if (!box) return null;
    for (const sel of box.querySelectorAll("select")) {
      const opt = sel.options[sel.selectedIndex];
      const k = opt && sel.selectedIndex > 0 ? kindOf(opt.textContent || "") : null;
      if (k) return k;
    }
    return null;
  }

  function setNative(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }
  // "I choose not to identify" and the form's own wording for it ("Decline To
  // Self Identify", "I don't wish to answer") are the same answer.
  const DECLINE = /decline|not (wish|want) to (answer|identify|disclose|say|self)|prefer not|choose not|rather not/i;
  function bestMatch(options, value) {
    const v = String(value).trim().toLowerCase();
    if (!v) return -1;
    const opts = options.map((o) => String(o).trim().toLowerCase());
    let i = opts.indexOf(v);
    if (i < 0) i = opts.findIndex((o) => o.startsWith(v) || v.startsWith(o));
    if (i < 0) i = opts.findIndex((o) => o.includes(v) || (o.length > 2 && v.includes(o)));
    if (i < 0 && DECLINE.test(v)) i = opts.findIndex((o) => DECLINE.test(o));
    return i;
  }

  // React-select dropdowns (Greenhouse, Ashby and others) ignore synthetic
  // clicks and keys. The background reads their options and picks one through
  // the component itself, in the page's own JavaScript world.
  function reactSelect(f, op, value) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "react-select", id: f.el.getAttribute("data-co-field"), op, value }, (r) => resolve(chrome.runtime.lastError ? null : r));
      } catch {
        resolve(null);
      }
    });
  }
  function mark(el, color, title) {
    if (!el) return;
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = "2px";
    if (title) el.title = title;
  }

  async function fillOne(f, value, res) {
    if (f.type === "file") {
      const kind = docKind(f);
      if (!kind || toggles[kind] === false) return false;
      const doc = res && res[kind];
      if (!doc || !doc.base64) return false;
      const bytes = Uint8Array.from(atob(doc.base64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], doc.name, { type: "application/pdf" }));
      f.el.files = dt.files;
      f.el.dispatchEvent(new Event("input", { bubbles: true }));
      f.el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    if (value == null || String(value).trim() === "") return false;
    if (f.type === "radio") {
      const i = bestMatch(f.group.map((r) => r.getAttribute("data-co-option") || ""), value);
      if (i < 0) return false;
      f.group[i].click();
      return true;
    }
    if (f.type === "checkbox") {
      if (/^(yes|true|checked|1|agree|i agree)$/i.test(String(value).trim()) && !f.el.checked) f.el.click();
      return true;
    }
    if (f.type === "select" && f.combobox) {
      const r = await reactSelect(f, "select", String(value));
      if (r && r.ok) return true;
      if (r && r.found) return false; // a react-select with no option matching the answer
      f.el.focus();
      setNative(f.el, String(value));
      await sleep(700);
      // Only this dropdown's own options: a page can keep other lists in the
      // DOM (Greenhouse's hidden phone-country list has 244 options).
      const own = f.el.getAttribute("aria-controls") && document.getElementById(f.el.getAttribute("aria-controls"));
      const opts = Array.from((own || document).querySelectorAll("[role=option]")).filter((o) => own || o.offsetParent !== null);
      const i = bestMatch(opts.map((o) => o.textContent || ""), value);
      if (i < 0) return false;
      opts[i].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      opts[i].click();
      return true;
    }
    if (f.type === "select") {
      const i = bestMatch(Array.from(f.el.options).map((o) => o.textContent || ""), value);
      if (i < 0) return false;
      setNative(f.el, f.el.options[i].value);
      return true;
    }
    let v = String(value);
    if (f.maxLength && v.length > f.maxLength) v = v.slice(0, f.maxLength);
    f.el.focus();
    setNative(f.el, v);
    return true;
  }

  // "If you answered yes to the question above, explain…" fields only apply
  // when the question before them is Yes.
  // NEOGOV numbers its labels ("Question 6. If you answered yes…"), so a
  // leading question number is allowed before the follow-up wording.
  const FOLLOW_UP = /^\s*(?:\*?\s*(?:question\s+)?\d+\s*[.:)]?\s*)?(if (you)?(answered|marked|selected|checked|responded) ["“']?yes|if yes\b|if so\b|if applicable, (explain|describe|list))/i;
  /** The current choice of the nearest visible radio group or select above
   *  todo[i] on the page. Read from the page, not the draft, because on a retry
   *  the question above was filled earlier and is not in this draft. */
  function choiceBefore(todo, i) {
    const el = todo[i].group ? todo[i].group[0] : todo[i].el;
    const before = Array.from(document.querySelectorAll("input[type=radio], select")).filter(
      (c) => c.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING && visible(c),
    );
    const prev = before[before.length - 1];
    if (!prev) return "";
    if (prev.tagName === "SELECT") return (prev.options[prev.selectedIndex]?.textContent || "").trim();
    const on = prev.name ? document.querySelector(`input[type=radio][name="${CSS.escape(prev.name)}"]:checked`) : prev.checked ? prev : null;
    return on ? on.getAttribute("data-co-option") || clean(labelFor(on)) || on.value || "" : "";
  }

  function draft(title, fields, docs = []) {
    return new Promise((resolve) => {
      const port = chrome.runtime.connect({ name: "draft" });
      const ping = setInterval(() => {
        try {
          port.postMessage({ type: "ping" });
        } catch {
          /* closed */
        }
      }, 20_000);
      const done = (v) => {
        clearInterval(ping);
        try {
          port.disconnect();
        } catch {
          /* closed */
        }
        resolve(v);
      };
      port.onMessage.addListener(done);
      port.onDisconnect.addListener(() => done({ error: "the extension restarted while drafting; reload the page to try again" }));
      port.postMessage({ type: "draft", title, fields, docs });
    });
  }

  // ---- the posting's own Apply button. A posting page often shows the job
  // description first and the form only after Apply, so the filler presses it
  // once per page, and only while no application form is on the page: on a
  // form, a button reading "Apply" can be the final submit. Third-party
  // sign-in buttons ("Apply with LinkedIn") are never pressed.
  const APPLY_TEXT = /^(apply|apply now|apply (online|here|today)|apply for (this )?(job|position|role|opening)|apply to (this )?(job|position|role)|apply manually|start (your |my )?application|begin (your )?application|i'?m interested)$/i;
  let pressedApply = false;
  function applyButton() {
    const els = document.querySelectorAll("a[href], button, input[type=button], input[type=submit], [role=button], [role=link]");
    for (const el of els) {
      if (!visible(el) || el.disabled || el.getAttribute("aria-disabled") === "true") continue;
      const text = clean(el.innerText || el.value || el.getAttribute("aria-label") || "");
      if (!APPLY_TEXT.test(text)) continue;
      // A submit button inside a form that has its own fields submits that form.
      const form = el.closest("form");
      if (form && Array.from(form.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select")).some(visible)) continue;
      return el;
    }
    return null;
  }
  function pressApply() {
    if (pressedApply || filledAny) return false;
    const el = applyButton();
    if (!el) return false;
    pressedApply = true;
    badge("Opening the application form…");
    // A link that opens a new tab is followed in this tab instead, so the
    // popup blocker can't stop it and the filler keeps the job.
    const href = el.tagName === "A" ? el.getAttribute("href") || "" : "";
    if (href && el.target === "_blank" && /^https?:/i.test(el.href)) location.href = el.href;
    else el.click();
    return true;
  }

  // ---- saved entries the site flags as incomplete. NEOGOV lists a profile's
  // saved jobs as read-only cards and outlines one in red when a required
  // field (Supervisor, say) is blank; its fields only exist after Edit. The
  // filler presses Edit once per flagged card. Edit only opens the entry: Save
  // stays with the user.
  const pressedEdit = new WeakSet();
  const isRed = (c) => {
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || "");
    return !!m && +m[1] > 150 && +m[2] < 90 && +m[3] < 90;
  };
  function flagged(el) {
    let c = el.parentElement;
    for (let i = 0; i < 8 && c && c !== document.body; i++, c = c.parentElement) {
      if (/\b(has-error|error|invalid)\b/i.test(c.className || "")) return true;
      const s = getComputedStyle(c);
      if (parseFloat(s.borderTopWidth) > 0 && isRed(s.borderTopColor)) return true;
    }
    return false;
  }
  function pressFlaggedEdit() {
    for (const el of document.querySelectorAll("a, button, [role=button]")) {
      if (pressedEdit.has(el) || !visible(el) || !/^edit$/i.test(clean(el.innerText || el.getAttribute("aria-label") || ""))) continue;
      if (!flagged(el)) continue;
      pressedEdit.add(el);
      badge("Opening an entry the site flagged as incomplete…");
      el.click();
      return true;
    }
    return false;
  }

  async function scan() {
    if (busy || stopped) return;
    if (onLoginPage()) {
      if (TOP && !filledAny) badge("Sign in here. Filling starts on its own once the application form shows.");
      return;
    }
    const fields = extract();
    const todo = fields.filter((f) => f.empty !== false);
    if (!looksLikeApplication(fields) || todo.length === 0) {
      fields.forEach((f) => (f.group || [f.el]).forEach((e) => e && e.removeAttribute("data-co-field")));
      if (!looksLikeApplication(fields) && pressApply()) return;
      if (todo.length === 0 && pressFlaggedEdit()) return;
      // A step of a multi-step application (NEOGOV's /apply/work lists the
      // profile's saved jobs) can have nothing blank on it.
      const onStep = /\/apply(\/|$)/i.test(location.pathname) || fields.length > 0;
      const idle = onStep
        ? "Nothing blank to fill on this step. Check it, then click Next yourself. Filling starts again on the next step."
        : "Waiting for the application form. Click the site's Apply button if it has one.";
      if (TOP && !filledAny && (!badgeText || badgeText.startsWith("On") || badgeText.startsWith("Opening") || badgeText.startsWith("Waiting") || badgeText.startsWith("Nothing blank"))) badge(idle);
      return;
    }
    busy = true;
    for (const f of todo) {
      if (!f.combobox) continue;
      const r = await reactSelect(f, "options");
      if (r && r.ok && r.options && r.options.length) f.options = r.options;
    }
    fields.forEach((f) => known.set(f.id, f));
    busy = true;
    batch += 1;
    badge(`Drafting answers for ${todo.length} fields. This can take a minute or two.`);
    const uploads = todo.filter((f) => f.type === "file").map((f) => docKind(f)).filter(Boolean);
    const wants = [...new Set(uploads.filter((k) => k !== "cv" && toggles[k] !== false))];
    const res = await draft(document.title, todo.map(({ id, type, label, required, options, maxLength }) => ({ id, type, label, required, options, maxLength })), wants);
    if (stopped) {
      busy = false;
      return;
    }
    if (res.error) {
      badge(`Couldn't draft answers: ${res.error}`, "err", true);
      busy = false;
      return;
    }
    let filled = 0;
    let confirm = 0;
    let notNeeded = 0;
    let optional = 0;
    // Choices first, typing second: picking a choice can re-render the fields
    // around it (Greenhouse's phone country code empties the phone number),
    // and an "if yes, explain" field reads the choice above it.
    const isChoice = (f) => f.type === "select" || f.type === "radio" || f.type === "checkbox";
    const order = [...todo.entries()].sort((x, y) => Number(!isChoice(x[1])) - Number(!isChoice(y[1])));
    const typed = [];
    for (const [i, f] of order) {
      const a = res.answers ? res.answers[f.id] : null;
      const value = a && typeof a === "object" ? a.value : a;
      const target = f.group ? f.group[0] : f.el;
      if (FOLLOW_UP.test(f.label) && /^no\b/i.test(choiceBefore(todo, i))) {
        notNeeded += 1;
        continue;
      }
      // An optional field the draft can't answer is left alone, not outlined:
      // only required ones need the user.
      if (a && a.needs_confirmation && f.type !== "file" && !f.required && !/\(required\)/i.test(f.label)) {
        optional += 1;
        continue;
      }
      if (a && a.needs_confirmation && f.type !== "file") {
        confirm += 1;
        mark(target, "#d97706", "career-ops: answer this one yourself");
        continue;
      }
      try {
        if (await fillOne(f, value, res)) {
          filled += 1;
          mark(target, "#16a34a");
          if (f.el && !isChoice(f) && f.type !== "file") typed.push([f, value]);
        }
      } catch {
        /* leave it for the user */
      }
    }
    // A text field the page emptied again while the rest filled gets its
    // answer once more.
    await sleep(500);
    for (const [f, value] of typed) {
      if (document.contains(f.el) && !f.el.value) {
        try {
          await fillOne(f, value, res);
        } catch {
          /* leave it for the user */
        }
      }
    }
    filledAny = true;
    // A page of only optional questions career-ops leaves to the user (a
    // voluntary EEO survey, say) would otherwise read "Filled 0 of 0".
    if (filled === 0 && confirm === 0 && optional > 0) {
      badge(`Nothing for career-ops to fill on this page: its ${optional} questions are optional and left to you (demographic, legal or similar). Answer any you want, then click Save & Continue yourself. Filling starts again on the next page.`, "info", false);
      busy = false;
      return;
    }
    const extra =confirm ? ` ${confirm} outlined in orange need your answer.` : "";
    const skipped = notNeeded ? ` ${notNeeded} "if yes, explain" left blank (answered No).` : "";
    const left = optional ? ` ${optional} optional left blank.` : "";
    const missingDocs = [...new Set(uploads.filter((k) => toggles[k] !== false && !(res && res[k])))];
    const docNote = missingDocs.length
      ? ` No ${missingDocs.map((k) => DOC_NAMES[k]).join(" or ")} saved for this job yet${missingDocs.includes("soq") ? ": ask Claude in Chrome to use career-reef-soq" : missingDocs.includes("cover") ? ": ask Claude in Chrome to use career-reef-cover-letter" : ""}, then click Try blank fields again.`
      : "";
    badge(`Filled ${filled} of ${todo.length - notNeeded - optional} fields.${extra}${skipped}${left}${docNote} Review everything, then submit it yourself.`, confirm ? "warn" : "ok", filled + notNeeded + optional < todo.length);
    busy = false;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(scan, 1200);
  }

  let observer = null;
  let poll = null;
  function start() {
    chrome.runtime.sendMessage({ type: "job" }, (job) => {
      if (chrome.runtime.lastError || !job) return;
      stopped = false;
      if (TOP && !filledAny) {
        badge(
          job.n
            ? `On for #${job.n} ${job.company}. Looking for the application form…`
            : job.unreachable
              ? "On, but the career-ops dashboard didn't answer. Is it running? Looking for the application form anyway…"
              : "On. This page didn't match a job in your pipeline, so the resume upload may be left for you. Looking for the application form…",
        );
      }
      if (!observer) {
        observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
      // Many sites reveal the form after Apply by changing a class or style, or
      // by showing a frame that already loaded hidden. Neither adds elements, so
      // keep looking every few seconds until the first fill.
      clearInterval(poll);
      poll = setInterval(() => (filledAny ? clearInterval(poll) : busy || scan()), 2500);
      schedule();
    });
  }
  // The toolbar button again: stop here. What is already filled stays.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== "stop") return;
    stopped = true;
    clearTimeout(timer);
    clearInterval(poll);
    if (observer) observer.disconnect();
    observer = null;
    if (TOP) document.getElementById("career-ops-badge")?.remove();
  });
  window.__careerOpsFiller = { start };
  start();
})();
