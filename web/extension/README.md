# career-ops Apply (Chrome extension)

Fills a job application in your own Chrome, so Google sign-in and saved site
logins work. It is off until you turn it on in a tab: click its toolbar button
(pin it from the puzzle-piece menu) or press **Alt+Shift+F**. The button shows
**ON** while it is on; click it again to stop. It runs only on job sites
(CalCareers, NEOGOV/governmentjobs, CalOpps, USAJOBS, Greenhouse, Lever,
Ashby, Workday, iCIMS, SmartRecruiters, Taleo and other ATSs, LinkedIn,
Indeed). On any other site, the first click asks Chrome for access to that
one site.

Once on, it presses the posting's own Apply button when no form shows yet,
waits out sign-in, reads the form, asks career-ops for drafted answers, and
fills the empty fields, page after page, until you turn it off or close the
tab. It attaches the tailored CV to the resume upload when the page matches a
job in your pipeline. It never clicks Submit or Next, never presses Apply on a
page that has a form, never uses "Apply with LinkedIn"-style buttons, never
overwrites what is already on the page, and leaves legal, visa, salary and
demographic questions blank, outlined in orange.

Without the extension, Apply falls back to the Playwright apply window.

## Install (once)

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick this folder (`web/extension`).
3. Make sure `web/.env.local` has the line below, then restart the dashboard:

   ```
   CAREER_OPS_ALLOWED_ORIGINS=chrome-extension://baiobcpkfadkeaelfggkidnnpcigpbdl
   ```

   The ID is fixed by the `key` in `manifest.json`, so it is the same on every
   machine.
4. Pick an AI CLI on the dashboard's Config page if you have not: drafting uses it.

## Use

Press **Apply** on the pipeline. The posting opens in a new tab with a
**Fill this application** button; sign in first if the site asks, then press
it (or the toolbar button). Or open any posting yourself and click the toolbar
button. If the site's button is worded differently
and nothing happens, click it yourself. A career-ops badge in the bottom-right corner shows
progress. On a multi-page form, each new page is filled when it appears. Review
every field, then submit it yourself. When the fill is done, the page's Submit
button is outlined in red and a desktop notification says the application is
ready. career-ops never presses Submit.

### Sign-in, captcha and paywall pages (v0.4.0)

When a page is a sign-in page, a single sign-on (Google, Microsoft, Okta), a
visible captcha or a paywall, career-ops stops that job at once. It never types
or stores a password. It then:

- shows **Needs sign-in** in the badge, with an **I'm signed in** button,
- raises a banner with a sound on Career Reef (every page), with **Open sign-in
  page** and **I'm signed in** buttons,
- shows a Windows desktop notification (click it to jump to the tab).

Sign in yourself, then press **I'm signed in** in either place. The job picks
up where it stopped. The stop survives page loads until you press it.

### Session boards (Remote Jobs Finder)

Some boards show listings only to signed-in members. career-ops never logs in
or works around that. Open the board in Chrome, sign in yourself, open its job
list, then click the career-ops toolbar button: on a session board it captures
the listings the page shows (title, company, link, location), runs them through
the same title and remote-scope filters as the scanner, and adds the new ones
to your Reef inbox. If the page is a login, quiz or paywall, it raises **Needs
sign-in** instead.

### Documents it attaches

The badge has three switches: **CV**, **SOQ** and **Cover letter**. Each one
attaches that job's own tailored document to the upload whose label (or
document-type dropdown) names it:

- **CV**: the tailored CV, on any job site.
- **SOQ**: the Statement of Qualifications, for CalCareers postings that ask
  for one.
- **Cover letter**: the tailored cover letter, for every other job (and for a
  CalCareers posting that asks for a cover letter instead).

The switches are saved and apply to every job until you change them. A
document that is not made yet is left for you, and the badge says so. Make it
in Chrome with the `career-reef-soq` or `career-reef-cover-letter` skill (or
`/career-ops soq N` / `/career-ops cover N` in Claude Code), then click
**Try blank fields again**. Career Reef lists each job's documents on its Reef
Watch panel.

## Files

- `bridge.js` runs on the dashboard and passes the Apply click to the extension.
- `background.js` opens the tab, remembers which tabs career-ops opened, and calls `/api/apply/extension/draft`.
- `filler.js` runs only in those tabs: stops at sign-in/captcha/paywall pages and alerts you, reads the form, fills it, outlines Submit.
- `icon128.png` is the notification icon.

## Updating (after a career-ops change to this folder)

Open `chrome://extensions`, find **career-ops Apply**, and click its reload
arrow. Then reload any job tabs that were already open. The version shown
there should read 0.4.0. The first click on a newly listed site may ask once
for access.
