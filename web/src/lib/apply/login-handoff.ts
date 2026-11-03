import fs from "node:fs";
import path from "node:path";
import type { BrowserContext, Page } from "playwright-core";
import { careerOpsRoot } from "@/lib/career-ops";
import { isLoginUrl } from "./login-url.mjs";

// When the real form sits behind a sign-in (or a human check), the off-screen
// apply window comes on-screen, the user signs in there THEMSELVES, and the
// apply run carries on once the page is past it. career-ops never types a
// password. The sign-in is kept in a storage-state file under the data root,
// so the next application on the same site skips it.

/** Where job-site cookies are kept between runs. data/ is gitignored. */
function stateFile(): string {
  return path.join(careerOpsRoot(), "data", "apply-browser", "storage-state.json");
}

/** Path to the saved sign-ins, or undefined when there are none yet. */
export function loadStorageState(): string | undefined {
  const file = stateFile();
  try {
    return fs.statSync(file).isFile() ? file : undefined;
  } catch {
    return undefined;
  }
}

/** Save the context's cookies + local storage for the next run. Best effort:
 *  a failed save costs a sign-in next time, never this application. */
export async function saveStorageState(context: BrowserContext): Promise<void> {
  const file = stateFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await context.storageState({ path: file });
    // Session cookies: readable by this user only (no-op on Windows).
    fs.chmodSync(file, 0o600);
  } catch {
    /* keep going */
  }
}

async function setWindow(context: BrowserContext, page: Page, left: number, top: number): Promise<void> {
  try {
    const cdp = await context.newCDPSession(page);
    const { windowId } = (await cdp.send("Browser.getWindowForTarget")) as { windowId: number };
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { left, top, width: 1280, height: 920, windowState: "normal" },
    });
    await cdp.detach().catch(() => {});
  } catch {
    /* CDP unavailable → bringToFront still raises it */
  }
}

/** Move the apply window on-screen and raise it. */
export async function showWindow(context: BrowserContext, page: Page): Promise<void> {
  await setWindow(context, page, 80, 60);
  await page.bringToFront().catch(() => {});
}

/** Move the apply window back off-screen, where it reads and fills. */
export async function hideWindow(context: BrowserContext, page: Page): Promise<void> {
  await setWindow(context, page, -3200, -3200);
}

export type HumanStep = "login-wall" | "bot-challenge";

/** Wait for the user to finish a sign-in or human check in the open window.
 *  True once the page is past it, false on timeout or a closed window. */
export async function waitForHuman(page: Page, kind: HumanStep, timeoutMs = 240_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  // Two clear reads in a row: a login form often blinks away and back while
  // it posts and redirects.
  let clear = 0;
  while (Date.now() < deadline) {
    if (page.isClosed()) return false;
    await page.waitForTimeout(2000).catch(() => {});
    if (page.isClosed()) return false;
    const blocked = kind === "login-wall" ? await onLoginStep(page) : await onChallenge(page);
    clear = blocked ? 0 : clear + 1;
    if (clear >= 2) {
      await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function onLoginStep(page: Page): Promise<boolean> {
  if (isLoginUrl(page.url())) return true;
  return page
    .evaluate(() =>
      Array.from(document.querySelectorAll('input[type="password"]')).some((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return (el as HTMLElement).offsetParent !== null && r.width > 0 && r.height > 0;
      }),
    )
    .catch(() => true); // mid-navigation: not done yet
}

async function onChallenge(page: Page): Promise<boolean> {
  return page
    .evaluate(() => {
      const t = (document.title || "").toLowerCase();
      if (/just a moment|checking your browser|one moment please|verifying you|attention required/.test(t)) return true;
      return !!document.querySelector(
        '#challenge-running, #challenge-form, .cf-browser-verification, iframe[src*="challenges.cloudflare.com"], #px-captcha, #cf-please-wait',
      );
    })
    .catch(() => true);
}
