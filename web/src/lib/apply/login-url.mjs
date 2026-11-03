// One definition of "this URL is a sign-in page", shared by the empty-form
// classifier and the wait-for-the-user loop, so the two never disagree on
// when a login is finished.
const LOGIN_PATH = /\/(login|log-?in|sign-?in|signin|register|sign-?up|auth|account|mfa|2fa|sso|oauth2?)(\/|$|\?|#)/i;

/** True when the URL's path looks like a sign-in, sign-up or MFA step. */
export function isLoginUrl(url) {
  if (typeof url !== "string" || !url) return false;
  try {
    const parsed = new URL(url);
    return LOGIN_PATH.test(`${parsed.pathname}${parsed.search}${parsed.hash}`) || /^(login|auth|sso|accounts?)\./i.test(parsed.hostname);
  } catch {
    return LOGIN_PATH.test(url);
  }
}
