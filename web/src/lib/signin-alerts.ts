import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { careerOpsRoot } from "@/lib/career-ops";

// "Needs sign-in" alerts. Raised by the career-ops Chrome extension (or any
// local worker) when a source or an apply flow hits a login, SSO, Google
// sign-in, captcha or paywall: the job stops there, and Reef Watch shows a
// banner (plus a desktop notification and a sound) until the user presses
// "I'm signed in". Nothing here signs in, stores a password or reads a
// credential; an alert holds only the site, the page URL and a reason.
//
// Stored in data/signin-alerts.json (user layer). Small, append-and-resolve.

export type SigninAlert = {
  id: string;
  site: string;
  url: string;
  loginUrl: string;
  reason: string;
  source: string;
  kind: "login" | "sso" | "captcha" | "paywall" | "unknown";
  createdAt: string;
  resolvedAt: string | null;
};

const KINDS = new Set(["login", "sso", "captcha", "paywall", "unknown"]);
const MAX_KEEP = 200;

function storePath(): string {
  return path.join(careerOpsRoot(), "data", "signin-alerts.json");
}

export function readSigninAlerts(): SigninAlert[] {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function write(alerts: SigninAlert[]): void {
  const p = storePath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(alerts.slice(-MAX_KEEP), null, 2));
  fs.renameSync(tmp, p);
}

export function openSigninAlerts(): SigninAlert[] {
  return readSigninAlerts().filter((a) => !a.resolvedAt);
}

function httpUrl(v: unknown): string {
  if (typeof v !== "string" || v.length > 2000) return "";
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch {
    return "";
  }
}

function text(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "";
}

/**
 * Raise an alert. One open alert per site: a repeat for the same host updates
 * that alert instead of stacking banners.
 */
export function raiseSigninAlert(input: Record<string, unknown>): SigninAlert | null {
  const url = httpUrl(input.url);
  if (!url) return null;
  const host = new URL(url).hostname.replace(/^www\./, "");
  const loginUrl = httpUrl(input.loginUrl) || url;
  // The login button may only point at the same site the alert is about.
  const loginHost = new URL(loginUrl).hostname.replace(/^www\./, "");
  const safeLogin = loginHost === host || loginHost.endsWith(`.${host}`) || host.endsWith(`.${loginHost}`) ? loginUrl : url;
  const kind = (KINDS.has(String(input.kind)) ? String(input.kind) : "unknown") as SigninAlert["kind"];
  const alerts = readSigninAlerts();
  const existing = alerts.find((a) => !a.resolvedAt && a.site === host);
  const reason = text(input.reason, 200) || "This page needs you to sign in.";
  const source = text(input.source, 60) || "apply";
  if (existing) {
    Object.assign(existing, { url, loginUrl: safeLogin, reason, kind, source, createdAt: new Date().toISOString() });
    write(alerts);
    return existing;
  }
  const alert: SigninAlert = {
    id: crypto.randomUUID(),
    site: host,
    url,
    loginUrl: safeLogin,
    reason,
    source,
    kind,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  alerts.push(alert);
  write(alerts);
  return alert;
}

/** "I'm signed in": resolve by id, or every open alert for a site. */
export function resolveSigninAlert({ id, site }: { id?: string; site?: string }): number {
  const alerts = readSigninAlerts();
  let n = 0;
  for (const a of alerts) {
    if (a.resolvedAt) continue;
    if ((id && a.id === id) || (site && a.site === site)) {
      a.resolvedAt = new Date().toISOString();
      n += 1;
    }
  }
  if (n) write(alerts);
  return n;
}
