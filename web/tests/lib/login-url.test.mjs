import test from "node:test";
import assert from "node:assert/strict";
import { isLoginUrl } from "../../src/lib/apply/login-url.mjs";

test("sign-in paths are login URLs", () => {
  for (const url of [
    "https://www.governmentjobs.com/Account/Login?ReturnUrl=%2Fcareers%2Fnapa",
    "https://acme.example.com/sign-in",
    "https://acme.example.com/signin?next=/apply",
    "https://acme.example.com/users/mfa/verify",
    "https://login.microsoftonline.com/common/oauth2/authorize",
  ]) {
    assert.equal(isLoginUrl(url), true, url);
  }
});

test("application pages are not login URLs", () => {
  for (const url of [
    "https://job-boards.greenhouse.io/acme/jobs/123",
    "https://www.governmentjobs.com/careers/napa/jobs/4012345/staff-services-analyst",
    "https://jobs.lever.co/acme/abc/apply",
    "https://acme.example.com/careers/accounting-analyst",
    "",
  ]) {
    assert.equal(isLoginUrl(url), false, url);
  }
});
