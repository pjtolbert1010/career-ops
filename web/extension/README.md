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
every field, then submit it yourself.

## Files

- `bridge.js` runs on the dashboard and passes the Apply click to the extension.
- `background.js` opens the tab, remembers which tabs career-ops opened, and calls `/api/apply/extension/draft`.
- `filler.js` runs only in those tabs: waits out sign-in, reads the form, fills it.
